import { Injectable, ConflictException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisposableDomain } from './disposable-domain.entity';
import { CreateDisposableDto } from './dto/create-disposable.dto';
import Redis from 'ioredis';

@Injectable()
export class DisposableEmailService implements OnModuleInit {
  private redisClient: Redis;
  private readonly REDIS_KEY = 'disposable:domains';

  constructor(
    @InjectRepository(DisposableDomain)
    private readonly disposableRepository: Repository<DisposableDomain>,
  ) {
    // Connexion Redis
    this.redisClient = new Redis({
      host: 'localhost',
      port: 6379,
      db: 0,
    });
  }

  /**
   * Charger tous les domaines en Redis au démarrage
   */
  async onModuleInit() {
    await this.loadDomainsToRedis();
  }

  /**
   * Charger les domaines de DB vers Redis
   */
  private async loadDomainsToRedis() {
    const count = await this.redisClient.scard(this.REDIS_KEY);

    if (count === 0) {
      console.log('Loading disposable domains to Redis...');
      
      // Charger par batch de 5000 pour éviter surcharge mémoire
      const batchSize = 5000;
      let offset = 0;
      let total = 0;

      while (true) {
        const domains = await this.disposableRepository.find({
          where: { isActive: true },
          select: ['domain'],
          skip: offset,
          take: batchSize,
        });

        if (domains.length === 0) break;

        const domainList = domains.map(d => d.domain);
        
        if (domainList.length > 0) {
          await this.redisClient.sadd(this.REDIS_KEY, ...domainList);
          total += domainList.length;
        }

        offset += batchSize;
        console.log(`Loaded ${total} domains to Redis...`);

        if (domains.length < batchSize) break;
      }

      console.log(`✅ Total ${total} disposable domains loaded to Redis`);
    } else {
      console.log(`✅ Redis already has ${count} disposable domains`);
    }
  }

  /**
   * Ajouter un domaine jetable
   */
  async create(createDto: CreateDisposableDto): Promise<DisposableDomain> {
    const normalizedDomain = createDto.domain.toLowerCase().trim();

    const existing = await this.disposableRepository.findOne({
      where: { domain: normalizedDomain },
    });

    if (existing) {
      throw new ConflictException(
        `Domain "${normalizedDomain}" already exists in disposable list`,
      );
    }

    const disposable = this.disposableRepository.create({
      domain: normalizedDomain,
      provider: createDto.provider,
      isCustom: createDto.isCustom ?? true,
      isActive: true,
    });

    const saved = await this.disposableRepository.save(disposable);

    // Ajouter à Redis immédiatement
    await this.redisClient.sadd(this.REDIS_KEY, normalizedDomain);

    return saved;
  }

  /**
   * Lister tous les domaines jetables
   */
  async findAll(): Promise<DisposableDomain[]> {
    return this.disposableRepository.find({
      where: { isActive: true },
      order: { domain: 'ASC' },
    });
  }

  /**
   * Trouver par ID
   */
  async findOne(id: string): Promise<DisposableDomain> {
    const domain = await this.disposableRepository.findOne({ where: { id } });
    if (!domain) {
      throw new NotFoundException(`Disposable domain with ID "${id}" not found`);
    }
    return domain;
  }

  /**
   * Supprimer (seulement custom)
   */
  async remove(id: string): Promise<void> {
    const domain = await this.findOne(id);

    if (!domain.isCustom) {
      throw new ConflictException(
        'Cannot delete built-in domain. Deactivate it instead.',
      );
    }

    // Supprimer de Redis
    await this.redisClient.srem(this.REDIS_KEY, domain.domain);

    await this.disposableRepository.remove(domain);
  }

  /**
   * Désactiver
   */
  async deactivate(id: string): Promise<DisposableDomain> {
    const domain = await this.findOne(id);
    domain.isActive = false;

    // Retirer de Redis
    await this.redisClient.srem(this.REDIS_KEY, domain.domain);

    return this.disposableRepository.save(domain);
  }

  /**
   * Réactiver
   */
  async activate(id: string): Promise<DisposableDomain> {
    const domain = await this.findOne(id);
    domain.isActive = true;

    // Ajouter à Redis
    await this.redisClient.sadd(this.REDIS_KEY, domain.domain);

    return this.disposableRepository.save(domain);
  }

  /**
   * Vérifier si un email utilise un domaine jetable
   * Performance: < 1ms grâce à Redis
   */
  async isDisposable(email: string): Promise<{
    isDisposable: boolean;
    provider?: string;
    confidence: number;
  }> {
    const normalizedEmail = email.toLowerCase().trim();
    const domain = normalizedEmail.split('@')[1];

    if (!domain) {
      return { isDisposable: false, confidence: 0 };
    }

    // Check Redis (< 1ms)
    const inRedis = await this.redisClient.sismember(this.REDIS_KEY, domain);

    if (inRedis === 1) {
      // Optionnel: récupérer le provider depuis DB
      const disposable = await this.disposableRepository.findOne({
        where: { domain, isActive: true },
        select: ['provider'],
      });

      return {
        isDisposable: true,
        provider: disposable?.provider,
        confidence: 1.0,
      };
    }

    return { isDisposable: false, confidence: 0 };
  }

  /**
   * Import bulk (depuis fichier)
   */
  async importBulk(domains: string[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    // Import par batch de 1000
    const batchSize = 1000;

    for (let i = 0; i < domains.length; i += batchSize) {
      const batch = domains.slice(i, i + batchSize);
      
      // Typage explicite du tableau
      const entities: Array<{
        domain: string;
        isCustom: boolean;
        isActive: boolean;
      }> = [];

      for (const domain of batch) {
        const normalizedDomain = domain.toLowerCase().trim();

        if (!normalizedDomain) {
          skipped++;
          continue;
        }

        const exists = await this.disposableRepository.findOne({
          where: { domain: normalizedDomain },
        });

        if (exists) {
          skipped++;
          continue;
        }

        entities.push({
          domain: normalizedDomain,
          isCustom: false,
          isActive: true,
        });
      }

      if (entities.length > 0) {
        await this.disposableRepository
          .createQueryBuilder()
          .insert()
          .into(DisposableDomain)
          .values(entities)
          .orIgnore()
          .execute();

        // Ajouter à Redis
        const domainList = entities.map(e => e.domain);
        await this.redisClient.sadd(this.REDIS_KEY, ...domainList);

        imported += entities.length;
      }

      console.log(`Progress: ${i + batch.length}/${domains.length} (imported: ${imported}, skipped: ${skipped})`);
    }

    return { imported, skipped };
  }

  /**
   * Compter les domaines
   */
  async count(): Promise<{ db: number; redis: number }> {
    const db = await this.disposableRepository.count({ where: { isActive: true } });
    const redis = await this.redisClient.scard(this.REDIS_KEY);
    return { db, redis };
  }

  /**
   * Forcer le reload Redis depuis DB
   */
  async reloadRedis(): Promise<void> {
    // Vider Redis
    await this.redisClient.del(this.REDIS_KEY);
    // Recharger
    await this.loadDomainsToRedis();
  }
}
