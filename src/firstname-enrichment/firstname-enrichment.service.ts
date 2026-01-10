import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InseeFirstname } from './entities/insee-firstname.entity';
import { AmbiguousFirstname } from './entities/ambiguous-firstname.entity';
import Redis from 'ioredis';

interface FirstnameData {
  maleCount: number;
  femaleCount: number;
  totalCount: number;
  genderRatio: number;
  dominantGender:  'M' | 'F' | null;
  estimatedAge: number | null;
  ageP25: number | null;
  ageP50: number | null;
  ageP75: number | null;
  peakDecade: string | null;
}

interface TokenInfo {
  type: 'AMBIGUOUS' | 'LASTNAME_ONLY';
  lastnameFrequency: 'high' | 'medium' | 'low';
}

@Injectable()
export class FirstnameEnrichmentService implements OnModuleInit {
  private readonly logger = new Logger(FirstnameEnrichmentService.name);
  private redisClient: Redis;
  private readonly REDIS_PREFIX = 'firstname: ';
  private readonly REDIS_TTL = 60 * 60 * 24;
  private tokenInfoMap: Map<string, TokenInfo> = new Map();

  private readonly BLACKLIST_TOKENS = new Set([
    'contact',
    'info',
    'admin',
    'support',
    'hello',
    'team',
    'sales',
    'mail',
    'no',
    'reply',
    'noreply',
    'service',
    'notification',
    'donotreply',
    'do-not-reply',
    'mailer-daemon',
    'postmaster',
  ]);

  constructor(
    @InjectRepository(InseeFirstname)
    private readonly firstnameRepository: Repository<InseeFirstname>,
    @InjectRepository(AmbiguousFirstname)
    private readonly ambiguousRepository: Repository<AmbiguousFirstname>,
  ) {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port:  parseInt(process.env.REDIS_PORT || '6379', 10),
      db: 0,
    });
  }

  async onModuleInit() {
    await this.loadTopFirstnamesToRedis();
    await this.loadTokenInfo();
  }

  private async loadTokenInfo() {
    this.logger.log('🔄 Loading token info (ambiguous + lastname_only)...');
    try {
      const tokens = await this.ambiguousRepository.find({
        select: ['firstname', 'tokenType', 'lastnameFrequency'],
      });

      this.tokenInfoMap = new Map(
        tokens.map((t) => [
          t.firstname. toLowerCase(),
          {
            type: t.tokenType,
            lastnameFrequency: t.lastnameFrequency,
          },
        ]),
      );

      const ambiguousCount = tokens.filter((t) => t.tokenType === 'AMBIGUOUS').length;
      const lastnameOnlyCount = tokens.filter((t) => t.tokenType === 'LASTNAME_ONLY').length;

      this.logger.log(`✅ Loaded ${this.tokenInfoMap.size} tokens (${ambiguousCount} ambiguous, ${lastnameOnlyCount} lastname_only)`);
    } catch (error) {
      this.logger.warn('⚠️ Could not load token info, continuing without ambiguity detection');
    }
  }

  private getTokenInfo(token: string): TokenInfo | null {
    return this.tokenInfoMap.get(token.toLowerCase()) || null;
  }

  private isAmbiguousFirstname(token: string): boolean {
    return this.getTokenInfo(token)?.type === 'AMBIGUOUS';
  }

  private isLastnameOnly(token: string): boolean {
    return this. getTokenInfo(token)?.type === 'LASTNAME_ONLY';
  }

  private async loadTopFirstnamesToRedis() {
    this.logger.log('Loading top firstname data to Redis...');
    try {
      const firstnames = await this.firstnameRepository.find({
        take: 5000,
        order: { totalCount: 'DESC' },
      });

      if (firstnames. length === 0) {
        this.logger.log('✅ Total 0 firstnames loaded to Redis');
        return;
      }

      for (const fn of firstnames) {
        const data: FirstnameData = {
          maleCount: fn. maleCount,
          femaleCount: fn.femaleCount,
          totalCount: fn.totalCount,
          genderRatio: fn.genderRatio,
          dominantGender: fn.dominantGender as 'M' | 'F' | null,
          estimatedAge: fn.estimatedAge,
          ageP25: fn.ageP25,
          ageP50: fn. ageP50,
          ageP75: fn.ageP75,
          peakDecade: fn.peakDecade,
        };

        await this. redisClient.set(
          `${this.REDIS_PREFIX}${fn.firstname}`,
          JSON.stringify(data),
          'EX',
          this.REDIS_TTL,
        );
      }

      this.logger.log(`✅ Loaded ${firstnames. length} top firstnames to Redis`);
    } catch (error) {
      this.logger.error('Error loading firstnames to Redis:', error);
    }
  }

  private async getFirstnameData(firstname: string): Promise<FirstnameData | null> {
    const key = `${this.REDIS_PREFIX}${firstname. toLowerCase()}`;

    try {
      const cached = await this.redisClient. get(key);
      if (cached) {
        if (cached === 'null') return null;
        return JSON.parse(cached);
      }

      const row = await this.firstnameRepository.findOne({
        where: { firstname:  firstname.toLowerCase() },
      });

      if (!row) {
        await this.redisClient.set(key, 'null', 'EX', this.REDIS_TTL);
        return null;
      }

      const data:  FirstnameData = {
        maleCount: row.maleCount,
        femaleCount:  row.femaleCount,
        totalCount: row.totalCount,
        genderRatio: row.genderRatio,
        dominantGender: row.dominantGender as 'M' | 'F' | null,
        estimatedAge: row. estimatedAge,
        ageP25: row.ageP25,
        ageP50: row.ageP50,
        ageP75: row.ageP75,
        peakDecade: row.peakDecade,
      };

      await this.redisClient. set(key, JSON.stringify(data), 'EX', this.REDIS_TTL);

      return data;
    } catch (error) {
      this.logger.error(`Error fetching firstname data for ${firstname}: `, error);
      return null;
    }
  }

  private calculateModernityFactor(data: FirstnameData, isAmbiguous: boolean): number {
    if (! isAmbiguous) {
      return 1.0;
    }

    const peakDecade = data.peakDecade || '1970s';
    const estimatedAge = data.estimatedAge;

    if (estimatedAge === null || estimatedAge === undefined) {
      const decadeYear = parseInt(peakDecade. replace('s', ''), 10);
      if (decadeYear >= 2000) return 1.15;
      if (decadeYear >= 1990) return 1.08;
      if (decadeYear >= 1980) return 1.0;
      if (decadeYear >= 1960) return 0.92;
      return 0.85;
    }

    const decadeYear = parseInt(peakDecade.replace('s', ''), 10);

    if (decadeYear < 1970 && estimatedAge < 40) {
      return 1.12;
    }

    if (estimatedAge <= 25) return 1.15;
    if (estimatedAge <= 35) return 1.10;
    if (estimatedAge <= 45) return 1.05;
    if (estimatedAge <= 55) return 1.0;
    if (estimatedAge <= 70) return 0.92;
    return 0.85;
  }

  private async calculateFirstnameStrength(token: string): Promise<number> {
    if (this.isLastnameOnly(token)) {
      return 0.0;
    }

    const data = await this.getFirstnameData(token);
    if (!data) return 0;

    const totalCount = data.totalCount || 0;
    const freqScore = Math.min(Math.log10(totalCount + 1) / 6.5, 1.0);

    const isAmb = this.isAmbiguousFirstname(token);
    const modernityFactor = this.calculateModernityFactor(data, isAmb);

    let ambiguityPenalty = 1.0;

    if (isAmb) {
      const tokenInfo = this.getTokenInfo(token);
      const peakDecade = data.peakDecade || '1970s';
      const decadeYear = parseInt(peakDecade.replace('s', ''), 10);

      const freqPenaltyMap = {
        high: 0.75,
        medium: 0.90,
        low: 0.98,
      };
      const baseAmbiguityPenalty = freqPenaltyMap[tokenInfo?.lastnameFrequency || 'medium'];

      if (decadeYear < 1970) {
        ambiguityPenalty = baseAmbiguityPenalty;
      } else if (decadeYear < 1990) {
        ambiguityPenalty = Math.min(baseAmbiguityPenalty + 0.05, 0.95);
      } else {
        ambiguityPenalty = 0.95;
      }
    }

    return freqScore * modernityFactor * ambiguityPenalty;
  }

  private calculateAmbiguityFactor(
    token: string,
    position: number,
    totalTokens: number,
    token0FirstnameStrength: number,
  ): number {
    const isTwoTokens = totalTokens === 2;

    if (this.isLastnameOnly(token) && position === 0) {
      return 0.05;
    }

    if (this.isLastnameOnly(token) && position === 1) {
      if (token0FirstnameStrength >= 0.70) {
        return 0.05;
      } else {
        return 0.15;
      }
    }

    const isAmb = this.isAmbiguousFirstname(token);

    if (position === 0 && !isAmb && ! this.isLastnameOnly(token)) {
      return isTwoTokens ? 1.25 : 1.15;
    }

    if (position === 0 && isAmb) {
      return isTwoTokens ? 0.85 : 0.9;
    }

    if (position === 1 && !isAmb && !this.isLastnameOnly(token)) {
      return isTwoTokens ? 1.15 : 1.05;
    }

    if (position === 1 && isAmb) {
      if (isTwoTokens) {
        if (token0FirstnameStrength >= 0.75) {
          return 0.80;
        }
        if (token0FirstnameStrength === 0.0) {
          return 1.30;
        }
        if (token0FirstnameStrength <= 0.20) {
          return 1.15;
        }
        return 0.95;
      }
      return 0.9;
    }

    if (isAmb) return 0.9;

    return 1.0;
  }

  private async calculateScore(
    token: string,
    position: number,
    totalTokens: number,
    token0FirstnameStrength: number,
  ): Promise<{ token: string; score: number; data: FirstnameData | null; tokenType: string }> {
    if (this.isLastnameOnly(token)) {
      const minScore = token0FirstnameStrength === 0.0 && position === 1 ? 2.0 : 0.5;

      return {
        token,
        score: minScore,
        data: null,
        tokenType: 'LASTNAME_ONLY',
      };
    }

    const data = await this.getFirstnameData(token);

    if (!data) {
      return {
        token,
        score: 0,
        data: null,
        tokenType: 'UNKNOWN',
      };
    }

    const totalCount = data.totalCount || 0;
    const freqScore = Math.min(Math.log10(totalCount + 1) / 6.5, 1.0);

    const len = token.length;
    let lengthScore = 1.0;
    if (len < 3) lengthScore = 0.7;
    else if (len > 15) lengthScore = 0.8;
    else if (len >= 3 && len <= 10) lengthScore = 1.0;

    let positionBonus = 1.0;
    if (position === 0) {
      positionBonus = 1.08;
    } else if (position === 1 && totalTokens === 2) {
      positionBonus = 1.05;
    }

    const genderRatio = data.genderRatio || 0;
    const purityBonus = genderRatio > 0.85 ? 1.05 : genderRatio > 0.7 ? 1.02 : 1.0;

    const isAmb = this.isAmbiguousFirstname(token);
    const modernityFactor = this.calculateModernityFactor(data, isAmb);

    const ambiguityFactor = this.calculateAmbiguityFactor(token, position, totalTokens, token0FirstnameStrength);

    const finalScore = Math.min(100 * freqScore * lengthScore * positionBonus * purityBonus * modernityFactor * ambiguityFactor, 100);

    return {
      token,
      score: finalScore,
      data,
      tokenType: isAmb ? 'AMBIGUOUS' : 'PURE_FIRSTNAME',
    };
  }

  private selectBestToken(
    scores: Array<{ token: string; score:  number; data: FirstnameData | null; tokenType: string }>,
  ): { token: string; score: number; data: FirstnameData } | null {
    const validScores = scores.filter((s) => s.score > 0 && s.data !== null).sort((a, b) => b.score - a.score);

    if (validScores.length === 0) return null;

    const best = validScores[0];
    const secondBest = validScores[1];

    if (best.score < 50) return null;

    if (secondBest && best.score < secondBest.score * 1.2) {
      return null;
    }

    return { token: best.token, score: best.score, data: best. data!  };
  }

  private extractLocalPart(email: string): string | null {
    const parts = email.split('@');
    if (parts.length < 2) return null;
    return parts[0]. trim().toLowerCase();
  }

  private tokenize(localPart: string): string[] {
    const tokens = localPart
      .split(/[\.\-_\+]/)
      .map((token) => {
        token = token.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z\-]/g, '');
        return token;
      })
      .filter((token) => {
        return token.length >= 2 && ! this.BLACKLIST_TOKENS.has(token);
      });

    return tokens;
  }

  private calculateAgeConfidence(data: FirstnameData): number {
    const iqr = (data.ageP75 ??  0) - (data.ageP25 ?? 0);
    const totalCount = data.totalCount || 0;

    let ageConf = 0.5;

    if (totalCount > 50000) ageConf += 0.2;
    if (totalCount > 200000) ageConf += 0.1;

    if (iqr && iqr <= 15) {
      ageConf += 0.2;
    } else if (iqr && iqr >= 30) {
      ageConf -= 0.1;
    }

    return Math.max(0.3, Math.min(0.95, ageConf));
  }

  private async extractFirstname(email: string): Promise<{
    firstName: string | null;
    confidence: number;
    normalizedInput: string | null;
    debug?:  any;
  }> {
    const localPart = this.extractLocalPart(email);
    if (!localPart) {
      return { firstName: null, confidence: 0, normalizedInput: null };
    }

    const tokens = this.tokenize(localPart);
    if (tokens.length === 0) {
      return { firstName: null, confidence: 0, normalizedInput: localPart };
    }

    const token0FirstnameStrength = await this.calculateFirstnameStrength(tokens[0]);

    const scores:  Array<{ token: string; score: number; data: FirstnameData | null; tokenType: string }> = [];
    for (let i = 0; i < tokens.length; i++) {
      const result = await this.calculateScore(tokens[i], i, tokens.length, token0FirstnameStrength);
      scores.push(result);
    }

    const bestToken = this.selectBestToken(scores);

    if (!bestToken) {
      const sorted = [... scores].sort((a, b) => b.score - a.score);

      return {
        firstName: null,
        confidence: 0,
        normalizedInput: localPart,
        debug: {
          allScores: sorted.map((s) => ({
            token: s.token,
            score: Math.round(s.score),
            tokenType: s.tokenType,
          })),
          token0Strength: token0FirstnameStrength. toFixed(2),
        },
      };
    }

    const capitalize = (str: string) => {
      return str
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join('-');
    };

    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const secondBestScore = sorted[1]?.score ??  0;
    const appliedRatio = secondBestScore > 0 ? (bestToken.score / secondBestScore).toFixed(2) : 'N/A';

    return {
      firstName: capitalize(bestToken. token),
      confidence: Math. round(bestToken.score),
      normalizedInput: localPart,
      debug: {
        allScores: sorted.map((s) => ({
          token:  s.token,
          score: Math.round(s.score),
          tokenType: s.tokenType,
        })),
        appliedRatio,
        token0Strength: token0FirstnameStrength.toFixed(2),
      },
    };
  }

  async enrich(email: string): Promise<{
    firstName: string | null;
    firstNameConfidence: number;
    civility: string | null;
    gender: 'M' | 'F' | null;
    genderConfidence: number | null;
    presumedAge: number | null;
    presumedAgeRange: { p25: number | null; p50: number | null; p75: number | null } | null;
    presumedAgeConfidence: number | null;
    peakDecade: string | null;
    detectedFrom: string | null;
    normalizedInput: string | null;
    warnings: string[];
    debug?: any;
  }> {
    const extraction = await this.extractFirstname(email);

    if (!extraction. firstName) {
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
        normalizedInput: extraction.normalizedInput,
        warnings: ['No valid firstname detected'],
        debug: extraction.debug,
      };
    }

    const data = await this.getFirstnameData(extraction.firstName. toLowerCase());

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
        normalizedInput:  extraction.normalizedInput,
        warnings: ['Firstname detected but no enrichment data available'],
        debug: extraction.debug,
      };
    }

    const gender = data.genderRatio >= 0.85 ? data.dominantGender : null;
    const civility = gender === 'M' ? 'M.' : gender === 'F' ? 'Mme' : null;
    const genderConfidence = gender ?  data.genderRatio : null;

    const ageConfidence = this.calculateAgeConfidence(data);

    return {
      firstName: extraction.firstName,
      firstNameConfidence:  extraction.confidence,
      civility,
      gender,
      genderConfidence,
      presumedAge: data.estimatedAge,
      presumedAgeRange:  {
        p25: data. ageP25,
        p50: data. ageP50,
        p75: data.ageP75,
      },
      presumedAgeConfidence: ageConfidence,
      peakDecade:  data.peakDecade,
      detectedFrom: 'email_local_part',
      normalizedInput: extraction.normalizedInput,
      warnings: ['Âge basé sur naissances INSEE, pas population vivante actuelle'],
      debug: extraction. debug,
    };
  }

  async importBatch(firstnames: any[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    try {
      const entities = firstnames.map((fn) =>
        this.firstnameRepository.create({
          firstname: fn.firstname,
          maleCount: fn.maleCount,
          femaleCount: fn.femaleCount,
          totalCount: fn.totalCount,
          genderRatio: fn. genderRatio,
          dominantGender: fn.dominantGender,
          birthYears: fn.birthYears || [],
          estimatedAge: fn.estimatedAge,
          ageP25: fn.ageP25,
          ageP50: fn.ageP50,
          ageP75: fn.ageP75,
          peakDecade: fn. peakDecade,
          source: 'insee',
        }),
      );

      const result = await this.firstnameRepository.upsert(entities, ['firstname']);
      imported = result.identifiers.length;

      for (const fn of firstnames) {
        const data:  FirstnameData = {
          maleCount: fn.maleCount,
          femaleCount: fn.femaleCount,
          totalCount: fn.totalCount,
          genderRatio: fn. genderRatio,
          dominantGender: fn.dominantGender,
          estimatedAge: fn.estimatedAge,
          ageP25: fn.ageP25,
          ageP50: fn. ageP50,
          ageP75: fn.ageP75,
          peakDecade: fn.peakDecade,
        };

        await this.redisClient.set(`${this. REDIS_PREFIX}${fn.firstname}`, JSON.stringify(data), 'EX', this.REDIS_TTL);
      }
    } catch (error) {
      this.logger.error('Error importing batch:', error);

      for (const fn of firstnames) {
        try {
          const existing = await this.firstnameRepository.findOne({
            where: { firstname: fn.firstname },
          });

          if (existing) {
            skipped++;
            continue;
          }

          const entity = this.firstnameRepository. create({
            firstname: fn. firstname,
            maleCount:  fn.maleCount,
            femaleCount: fn.femaleCount,
            totalCount: fn.totalCount,
            genderRatio: fn.genderRatio,
            dominantGender: fn.dominantGender,
            birthYears: fn. birthYears || [],
            estimatedAge: fn.estimatedAge,
            ageP25: fn.ageP25,
            ageP50: fn. ageP50,
            ageP75: fn.ageP75,
            peakDecade: fn.peakDecade,
            source: 'insee',
          });

          await this.firstnameRepository.save(entity);

          const data: FirstnameData = {
            maleCount: fn. maleCount,
            femaleCount: fn.femaleCount,
            totalCount: fn.totalCount,
            genderRatio: fn.genderRatio,
            dominantGender: fn.dominantGender,
            estimatedAge: fn.estimatedAge,
            ageP25: fn.ageP25,
            ageP50: fn.ageP50,
            ageP75: fn. ageP75,
            peakDecade: fn.peakDecade,
          };

          await this.redisClient.set(`${this.REDIS_PREFIX}${fn.firstname}`, JSON.stringify(data), 'EX', this.REDIS_TTL);

          imported++;
        } catch (err) {
          this.logger. error(`Error importing firstname ${fn.firstname}:`, err);
          skipped++;
        }
      }
    }

    return { imported, skipped };
  }

async getStats(): Promise<{
  totalFirstnames:  number;
  source: string;
  dataset: string;
  lastUpdate: Date;
}> {
  const count = await this.firstnameRepository.count();
  
  // ✅ FIX : Utiliser find() avec take: 1
  const latest = await this.firstnameRepository.find({
    order: { createdAt: 'DESC' },
    take: 1,
  });
  
  return {
    totalFirstnames:  count,
    source: 'insee',
    dataset: 'nat2022',
    lastUpdate: latest[0]?.createdAt || new Date(),
  };
}

  async getTop(limit: number = 100): Promise<any[]> {
    const firstnames = await this.firstnameRepository.find({
      take: limit,
      order: { totalCount: 'DESC' },
    });

    return firstnames. map((fn) => ({
      firstname: fn.firstname,
      totalCount: fn.totalCount,
      maleCount: fn.maleCount,
      femaleCount: fn.femaleCount,
      dominantGender: fn.dominantGender,
      estimatedAge: fn.estimatedAge,
      peakDecade: fn.peakDecade,
    }));
  }
}