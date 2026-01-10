import { Injectable, ConflictException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InseeFirstname } from './entities/insee-firstname.entity';
import { CreateFirstnameDto } from './dto/create-firstname.dto';
import { EnrichmentResponseDto } from './dto/enrichment-response.dto';
import Redis from 'ioredis';

@Injectable()
export class FirstnameEnrichmentService implements OnModuleInit {
  private redisClient: Redis;
  private readonly REDIS_PREFIX = 'firstname:';
  
  // Blacklist tokens
  private readonly BLACKLIST_TOKENS = new Set([
    'contact', 'info', 'admin', 'support', 'hello', 'team', 
    'sales', 'mail', 'no', 'reply', 'noreply', 'service'
  ]);

  constructor(
    @InjectRepository(InseeFirstname)
    private readonly firstnameRepository: Repository<InseeFirstname>,
  ) {
    // Connexion Redis
    this.redisClient = new Redis({
      host: 'localhost',
      port: 6379,
      db: 0,
    });
  }

  /**
   * Charger tous les prénoms en Redis au démarrage
   */
  async onModuleInit() {
    await this.loadFirstnamesToRedis();
  }

  /**
   * Charger les prénoms de DB vers Redis
   */
  private async loadFirstnamesToRedis() {
    // Check if already loaded
    const keys = await this.redisClient.keys(`${this.REDIS_PREFIX}*`);
    
    if (keys.length === 0) {
      console.log('Loading firstname data to Redis...');
      
      const batchSize = 5000;
      let offset = 0;
      let total = 0;

      while (true) {
        const firstnames = await this.firstnameRepository.find({
          skip: offset,
          take: batchSize,
        });

        if (firstnames.length === 0) break;

        // Store each firstname data in Redis
        const pipeline = this.redisClient.pipeline();
        
        for (const fn of firstnames) {
          const key = `${this.REDIS_PREFIX}${fn.firstname}`;
          const data = {
            maleCount: fn.maleCount,
            femaleCount: fn.femaleCount,
            totalCount: fn.totalCount,
            genderRatio: fn.genderRatio,
            dominantGender: fn.dominantGender,
            estimatedAge: fn.estimatedAge,
            ageP25: fn.ageP25,
            ageP50: fn.ageP50,
            ageP75: fn.ageP75,
            peakDecade: fn.peakDecade,
          };
          pipeline.set(key, JSON.stringify(data));
        }

        await pipeline.exec();
        total += firstnames.length;
        offset += batchSize;
        
        console.log(`Loaded ${total} firstnames to Redis...`);

        if (firstnames.length < batchSize) break;
      }

      console.log(`✅ Total ${total} firstnames loaded to Redis`);
    } else {
      console.log(`✅ Redis already has ${keys.length} firstnames`);
    }
  }

  /**
   * Normalize string with NFKD and lowercase
   */
  private normalize(str: string): string {
    return str
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .toLowerCase();
  }

  /**
   * Extract and normalize email local part
   */
  private extractLocalPart(email: string): string | null {
    const parts = email.split('@');
    if (parts.length < 2) return null;
    
    let local = parts[0];
    
    // Normalize
    local = this.normalize(local);
    
    // Convert separators to dots
    local = local.replace(/[_\-+]/g, '.');
    
    // Remove non-alphanumeric except dots
    local = local.replace(/[^a-z0-9.]/g, '');
    
    return local;
  }

  /**
   * Clean a token (remove digits at prefix/suffix, keep hyphens)
   */
  private cleanToken(token: string): string {
    // Remove digits at start
    token = token.replace(/^\d+/, '');
    // Remove digits at end
    token = token.replace(/\d+$/, '');
    // Remove punctuation except hyphens
    token = token.replace(/[^a-z\-]/g, '');
    return token;
  }

  /**
   * Tokenize and filter the local part
   */
  private tokenize(localPart: string): string[] {
    const tokens = localPart.split('.');
    
    return tokens
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(t => this.cleanToken(t))
      .filter(t => t.length >= 2) // Filter tokens < 2 chars
      .filter(t => !this.BLACKLIST_TOKENS.has(t)); // Filter blacklist
  }

  /**
   * Get firstname data from Redis
   */
  private async getFirstnameData(firstname: string): Promise<any | null> {
    const key = `${this.REDIS_PREFIX}${firstname}`;
    const data = await this.redisClient.get(key);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Calculate score for a token
   */
  private async calculateScore(token: string, position: number, totalTokens: number): Promise<{ token: string; score: number; data: any | null }> {
    const data = await this.getFirstnameData(token);
    
    if (!data) {
      return { token, score: 0, data: null };
    }

    const totalCount = data.totalCount || 0;
    
    // Frequency score (0-1)
    const freqScore = Math.min(Math.log10(totalCount + 1) / 5, 1.0);
    
    // Length score
    const len = token.length;
    let lengthScore = 1.0;
    if (len < 3) lengthScore = 0.7;
    else if (len > 15) lengthScore = 0.8;
    else if (len >= 3 && len <= 10) lengthScore = 1.0;
    
    // Position bonus
    let positionBonus = 1.0;
    if (totalTokens === 2 && position === 1) {
      positionBonus = 1.15; // Second token in 2-token pattern (likely martin.jean)
    } else if (position === 0) {
      positionBonus = 1.1; // First token
    }
    
    // Purity bonus (pure gender vs ambiguous)
    const genderRatio = data.genderRatio || 0;
    const purityBonus = genderRatio > 0.8 ? 1.05 : 1.0;
    
    // Final score (guaranteed 0-100)
    const finalScore = Math.min(100 * freqScore * lengthScore * positionBonus * purityBonus, 100);
    
    return { token, score: finalScore, data };
  }

  /**
   * Select best token with ambiguity check
   */
  private selectBestToken(scores: Array<{ token: string; score: number; data: any }>): { token: string; score: number; data: any } | null {
    if (scores.length === 0) return null;
    
    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);
    
    const best = scores[0];
    const secondBest = scores.length > 1 ? scores[1] : null;
    
    // Double condition: absolute threshold AND ratio check
    if (best.score < 50) return null;
    
    if (secondBest && best.score < secondBest.score * 1.25) {
      // Too ambiguous
      return null;
    }
    
    return best;
  }

  /**
   * Extract firstname from email
   */
  private async extractFirstname(email: string): Promise<{
    firstName: string | null;
    confidence: number;
    normalizedInput: string | null;
    debug?: any;
  }> {
    const localPart = this.extractLocalPart(email);
    
    if (!localPart) {
      return {
        firstName: null,
        confidence: 0,
        normalizedInput: null,
      };
    }

    const tokens = this.tokenize(localPart);
    
    if (tokens.length === 0) {
      return {
        firstName: null,
        confidence: 0,
        normalizedInput: localPart,
      };
    }

    // Calculate scores for all tokens
    const scores = [];
    for (let i = 0; i < tokens.length; i++) {
      const result = await this.calculateScore(tokens[i], i, tokens.length);
      scores.push(result);
    }

    const bestToken = this.selectBestToken(scores);
    
    if (!bestToken) {
      return {
        firstName: null,
        confidence: 0,
        normalizedInput: localPart,
        debug: {
          allScores: scores.map(s => ({ token: s.token, score: Math.round(s.score) })),
        },
      };
    }

    // Capitalize first letter (handle compound names like jean-pierre)
    const capitalize = (str: string) => {
      return str.split('-').map(part => 
        part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
      ).join('-');
    };

    const secondBestScore = scores.length > 1 ? scores[1].score : 0;
    const appliedRatio = secondBestScore > 0 ? (bestToken.score / secondBestScore).toFixed(2) : 'N/A';

    return {
      firstName: capitalize(bestToken.token),
      confidence: Math.round(bestToken.score),
      normalizedInput: localPart,
      debug: {
        allScores: scores.map(s => ({ token: s.token, score: Math.round(s.score) })),
        appliedRatio,
      },
    };
  }

  /**
   * Deduce civility from gender data
   */
  private deduceCivility(data: any): {
    civility: string | null;
    gender: string | null;
    genderConfidence: number | null;
  } {
    const maleCount = data.maleCount || 0;
    const femaleCount = data.femaleCount || 0;
    const total = maleCount + femaleCount;
    
    if (total === 0) {
      return { civility: null, gender: null, genderConfidence: null };
    }

    const pMale = maleCount / total;
    const pFemale = femaleCount / total;
    
    if (pMale >= 0.85) {
      return {
        civility: 'M.',
        gender: 'M',
        genderConfidence: pMale,
      };
    }
    
    if (pFemale >= 0.85) {
      return {
        civility: 'Mme',
        gender: 'F',
        genderConfidence: pFemale,
      };
    }
    
    // Ambiguous (mixed names like Camille, Dominique)
    return {
      civility: null,
      gender: null,
      genderConfidence: Math.max(pMale, pFemale),
    };
  }

  /**
   * Calculate age confidence
   */
  private calculateAgeConfidence(totalCount: number): number {
    if (totalCount > 100000) return 0.9;
    if (totalCount > 10000) return 0.75;
    if (totalCount > 1000) return 0.6;
    return 0.3;
  }

  /**
   * Main enrichment method
   */
  async enrich(email: string): Promise<EnrichmentResponseDto> {
    const extraction = await this.extractFirstname(email);
    
    if (!extraction.firstName) {
      return {
        firstName: null,
        firstNameConfidence: 0,
        civility: null,
        gender: null,
        genderConfidence: null,
        presumedAge: null,
        presumedAgeRange: null,
        presumedAgeConfidence: null,
        peakDecade: null,
        detectedFrom: null,
        normalizedInput: null,
        warnings: ['No valid firstname detected'],
      };
    }

    // Get data from Redis
    const data = await this.getFirstnameData(extraction.firstName.toLowerCase());
    
    if (!data) {
      return {
        firstName: extraction.firstName,
        firstNameConfidence: extraction.confidence,
        civility: null,
        gender: null,
        genderConfidence: null,
        presumedAge: null,
        presumedAgeRange: null,
        presumedAgeConfidence: null,
        peakDecade: null,
        detectedFrom: 'email_local_part',
        normalizedInput: extraction.normalizedInput,
        warnings: ['Firstname detected but no demographic data available'],
        debug: extraction.debug,
      };
    }

    const civilityInfo = this.deduceCivility(data);
    const ageConfidence = this.calculateAgeConfidence(data.totalCount);
    
    const warnings = ['Âge basé sur naissances INSEE, pas population vivante actuelle'];
    
    if (data.totalCount < 1000) {
      warnings.push('Prénom rare, scoring avec confiance réduite');
    }

    return {
      firstName: extraction.firstName,
      firstNameConfidence: extraction.confidence,
      civility: civilityInfo.civility,
      gender: civilityInfo.gender,
      genderConfidence: civilityInfo.genderConfidence,
      presumedAge: data.estimatedAge,
      presumedAgeRange: data.ageP25 && data.ageP50 && data.ageP75 ? {
        p25: data.ageP25,
        p50: data.ageP50,
        p75: data.ageP75,
      } : null,
      presumedAgeConfidence: ageConfidence,
      peakDecade: data.peakDecade,
      detectedFrom: 'email_local_part',
      normalizedInput: extraction.normalizedInput,
      warnings,
      debug: extraction.debug,
    };
  }

  /**
   * Import batch of firstnames
   */
  async importBatch(firstnames: CreateFirstnameDto[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const dto of firstnames) {
      const normalizedFirstname = this.normalize(dto.firstname);

      const existing = await this.firstnameRepository.findOne({
        where: { firstname: normalizedFirstname },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const entity = this.firstnameRepository.create({
        firstname: normalizedFirstname,
        maleCount: dto.maleCount,
        femaleCount: dto.femaleCount,
        totalCount: dto.totalCount,
        genderRatio: dto.genderRatio,
        dominantGender: dto.dominantGender,
        birthYears: dto.birthYears,
        estimatedAge: dto.estimatedAge,
        ageP25: dto.ageP25,
        ageP50: dto.ageP50,
        ageP75: dto.ageP75,
        peakDecade: dto.peakDecade,
      });

      await this.firstnameRepository.save(entity);

      // Add to Redis
      const key = `${this.REDIS_PREFIX}${normalizedFirstname}`;
      const data = {
        maleCount: dto.maleCount,
        femaleCount: dto.femaleCount,
        totalCount: dto.totalCount,
        genderRatio: dto.genderRatio,
        dominantGender: dto.dominantGender,
        estimatedAge: dto.estimatedAge,
        ageP25: dto.ageP25,
        ageP50: dto.ageP50,
        ageP75: dto.ageP75,
        peakDecade: dto.peakDecade,
      };
      await this.redisClient.set(key, JSON.stringify(data));

      imported++;
    }

    return { imported, skipped };
  }

  /**
   * Get top 100 firstnames by frequency
   */
  async findAll(): Promise<InseeFirstname[]> {
    return this.firstnameRepository.find({
      order: { totalCount: 'DESC' },
      take: 100,
    });
  }

  /**
   * Count total firstnames in database
   */
  async count(): Promise<number> {
    return this.firstnameRepository.count();
  }
}
