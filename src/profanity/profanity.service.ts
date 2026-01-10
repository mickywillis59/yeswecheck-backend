import {
  Injectable,
  ConflictException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { ProfanityWord } from './profanity.entity';
import { CreateProfanityDto } from './dto/create-profanity.dto';

@Injectable()
export class ProfanityService implements OnModuleInit {
  private redisClient: Redis;
  private readonly REDIS_KEY_PREFIX = 'profanity';

  constructor(
    @InjectRepository(ProfanityWord)
    private profanityRepository: Repository<ProfanityWord>,
  ) {
    // Connexion Redis directe
    this.redisClient = new Redis({
      host: 'localhost',
      port: 6379,
      db: 0,
    });
  }

  /**
   * Charger tous les mots actifs en Redis au démarrage
   */
  async onModuleInit(): Promise<void> {
    await this.initializeRedis();
  }

  /**
   * Initialiser Redis avec les mots de la base de données
   */
  async initializeRedis(): Promise<void> {
    console.log('🔄 Initializing profanity words in Redis...');

    const words = await this.profanityRepository.find({
      where: { isActive: true },
    });

    if (words.length === 0) {
      console.log('⚠️  No profanity words found in database');
      return;
    }

    // Grouper par langue
    const wordsByLang: Record<string, string[]> = {};

    for (const word of words) {
      if (!wordsByLang[word.language]) {
        wordsByLang[word.language] = [];
      }
      wordsByLang[word.language].push(word.word.toLowerCase());
    }

    // Charger dans Redis
    for (const [lang, wordList] of Object.entries(wordsByLang)) {
      const key = `${this.REDIS_KEY_PREFIX}:${lang}`;

      // Vider la clé avant de remplir
      await this.redisClient.del(key);

      if (wordList.length > 0) {
        await this.redisClient.sadd(key, ...wordList);
      }
    }

    console.log(`✅ Loaded ${words.length} profanity words in Redis`);
  }

  /**
   * Recharger Redis manuellement
   */
  async reloadRedis(): Promise<void> {
    await this.initializeRedis();
  }

  /**
   * Ajouter un mot manuellement
   */
  async create(createDto: CreateProfanityDto): Promise<ProfanityWord> {
    const normalizedWord = createDto.word.toLowerCase().trim();

    const existing = await this.profanityRepository.findOne({
      where: { word: normalizedWord, language: createDto.language },
    });

    if (existing) {
      throw new ConflictException(
        `Word "${normalizedWord}" already exists for language ${createDto.language}`,
      );
    }

    const profanityWord = this.profanityRepository.create({
      word: normalizedWord,
      language: createDto.language || 'en',
      severity: createDto.severity || 'medium',
      category: createDto.category,
      isCustom: true,
      isActive: true,
      source: 'custom',
    });

    const saved = await this.profanityRepository.save(profanityWord);

    // Ajouter à Redis
    const key = `${this.REDIS_KEY_PREFIX}:${saved.language}`;
    await this.redisClient.sadd(key, normalizedWord);

    return saved;
  }

  /**
   * Lister tous les mots
   */
  async findAll(language?: string): Promise<ProfanityWord[]> {
    if (language) {
      return this.profanityRepository.find({
        where: { language, isActive: true },
        order: { word: 'ASC' },
      });
    }
    return this.profanityRepository.find({
      where: { isActive: true },
      order: { language: 'ASC', word: 'ASC' },
    });
  }

  /**
   * Trouver un mot par ID
   */
  async findOne(id: string): Promise<ProfanityWord> {
    const word = await this.profanityRepository.findOne({ where: { id } });
    if (!word) {
      throw new NotFoundException(`Profanity word with ID "${id}" not found`);
    }
    return word;
  }

  /**
   * Supprimer un mot
   */
  async remove(id: string): Promise<void> {
    const word = await this.findOne(id);

    // Retirer de Redis
    const key = `${this.REDIS_KEY_PREFIX}:${word.language}`;
    await this.redisClient.srem(key, word.word);

    await this.profanityRepository.remove(word);
  }

  /**
   * Désactiver un mot
   */
  async deactivate(id: string): Promise<ProfanityWord> {
    const word = await this.findOne(id);
    word.isActive = false;

    // Retirer de Redis
    const key = `${this.REDIS_KEY_PREFIX}:${word.language}`;
    await this.redisClient.srem(key, word.word);

    return this.profanityRepository.save(word);
  }

  /**
   * Réactiver un mot
   */
  async activate(id: string): Promise<ProfanityWord> {
    const word = await this.findOne(id);
    word.isActive = true;

    // Ajouter à Redis
    const key = `${this.REDIS_KEY_PREFIX}:${word.language}`;
    await this.redisClient.sadd(key, word.word);

    return this.profanityRepository.save(word);
  }

  /**
   * Vérifier si un email contient des gros mots (< 1ms grâce à Redis)
   */
  async checkProfanity(email: string): Promise<{
    hasProfanity: boolean;
    words: string[];
    severity: string;
    normalizedLocal: string;
  }> {
    const localPart = email.split('@')[0];

    if (!localPart) {
      return {
        hasProfanity: false,
        words: [],
        severity: 'none',
        normalizedLocal: '',
      };
    }

    // Normaliser la partie locale (enlever leetspeak, caractères spéciaux)
    const normalized = this.normalize(localPart);

    // Chercher dans toutes les langues (EN + FR)
    const foundWords: string[] = [];

    // Check EN
    const wordsEN = await this.findProfanityInText(normalized, 'en');
    foundWords.push(...wordsEN);

    // Check FR
    const wordsFR = await this.findProfanityInText(normalized, 'fr');
    foundWords.push(...wordsFR);

    if (foundWords.length === 0) {
      return {
        hasProfanity: false,
        words: [],
        severity: 'none',
        normalizedLocal: normalized,
      };
    }

    // Déterminer la sévérité maximale
    const severity = await this.getMaxSeverity(foundWords);

    return {
      hasProfanity: true,
      words: [...new Set(foundWords)], // Dédupliquer
      severity,
      normalizedLocal: normalized,
    };
  }

  /**
   * Normaliser le texte :  enlever caractères spéciaux et remplacer leetspeak
   */
  private normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[._\-+]/g, '') // Enlever . _ - +
      .replace(/0/g, 'o')
      .replace(/1/g, 'i')
      .replace(/3/g, 'e')
      .replace(/4/g, 'a')
      .replace(/5/g, 's')
      .replace(/7/g, 't')
      .replace(/8/g, 'b')
      .replace(/@/g, 'a')
      .replace(/\$/g, 's')
      .replace(/\*/g, '')
      .replace(/!/g, 'i');
  }

  /**
   * Chercher des mots profanes dans un texte (via Redis < 1ms)
   */
  private async findProfanityInText(
    text: string,
    language: string,
  ): Promise<string[]> {
    const key = `${this.REDIS_KEY_PREFIX}:${language}`;

    // Récupérer tous les mots de cette langue depuis Redis
    const allWords = await this.redisClient.smembers(key);

    const found: string[] = [];

    for (const word of allWords) {
      if (text.includes(word)) {
        found.push(word);
      }
    }

    return found;
  }

  /**
   * Déterminer la sévérité maximale parmi les mots trouvés
   */
  private async getMaxSeverity(words: string[]): Promise<string> {
    const severities = await Promise.all(
      words.map(async (word) => {
        const profanityWord = await this.profanityRepository.findOne({
          where: { word, isActive: true },
        });
        return profanityWord?.severity || 'medium';
      }),
    );

    if (severities.includes('high')) return 'high';
    if (severities.includes('medium')) return 'medium';
    return 'low';
  }

  /**
   * Import bulk depuis liste externe
   */
  async importBulk(data: {
    words: string[];
    language: string;
    severity?: 'low' | 'medium' | 'high';
    source?: string;
  }): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    const batchSize = 500;
    const { words, language, severity = 'medium', source = 'external' } = data;

    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);

      const entities: Array<{
        word: string;
        language: string;
        severity: 'low' | 'medium' | 'high';
        isCustom: boolean;
        isActive: boolean;
        source: string;
      }> = [];

      for (const word of batch) {
        const normalizedWord = word.toLowerCase().trim();

        if (!normalizedWord || normalizedWord.length < 3) {
          skipped++;
          continue;
        }

        const exists = await this.profanityRepository.findOne({
          where: { word: normalizedWord, language },
        });

        if (exists) {
          skipped++;
          continue;
        }

        entities.push({
          word: normalizedWord,
          language,
          severity,
          isCustom: false,
          isActive: true,
          source,
        });
      }

      if (entities.length > 0) {
        await this.profanityRepository
          .createQueryBuilder()
          .insert()
          .into(ProfanityWord)
          .values(entities)
          .orIgnore()
          .execute();

        // Ajouter à Redis
        const key = `${this.REDIS_KEY_PREFIX}:${language}`;
        const wordList = entities.map((e) => e.word);
        await this.redisClient.sadd(key, ...wordList);

        imported += entities.length;
      }

      console.log(
        `Progress: ${i + batch.length}/${words.length} (imported: ${imported}, skipped: ${skipped})`,
      );
    }

    return { imported, skipped };
  }

  /**
   * Compter les mots
   */
  async count(
    language?: string,
  ): Promise<{ total: number; byLanguage?: Record<string, number> }> {
    if (language) {
      const total = await this.profanityRepository.count({
        where: { language, isActive: true },
      });
      return { total };
    }

    const all = await this.profanityRepository.find({
      where: { isActive: true },
    });

    const byLanguage: Record<string, number> = {};
    for (const word of all) {
      byLanguage[word.language] = (byLanguage[word.language] || 0) + 1;
    }

    return {
      total: all.length,
      byLanguage,
    };
  }
}
