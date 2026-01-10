import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Blacklist } from './blacklist.entity';
import { CreateBlacklistDto } from './dto/create-blacklist.dto';

@Injectable()
export class BlacklistService {
  constructor(
    @InjectRepository(Blacklist)
    private blacklistRepository: Repository<Blacklist>,
  ) {}

  /**
   * Ajouter un email ou domaine à la blacklist
   */
  async create(createDto: CreateBlacklistDto): Promise<Blacklist> {
    const normalizedValue = createDto.value.toLowerCase().trim();

    const existing = await this.blacklistRepository.findOne({
      where: { value: normalizedValue },
    });

    if (existing) {
      throw new ConflictException(
        `${createDto.type} "${normalizedValue}" is already in blacklist`,
      );
    }

    const blacklist = this.blacklistRepository.create({
      type: createDto.type,
      value: normalizedValue,
      reason: createDto.reason,
    });

    return this.blacklistRepository.save(blacklist);
  }

  /**
   * Lister tous les éléments de la blacklist
   */
  async findAll(type?: 'domain' | 'email'): Promise<Blacklist[]> {
    if (type) {
      return this.blacklistRepository.find({
        where: { type, isActive: true },
        order: { createdAt: 'DESC' },
      });
    }
    return this.blacklistRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Trouver un élément par ID
   */
  async findOne(id: string): Promise<Blacklist> {
    const blacklist = await this.blacklistRepository.findOne({ where: { id } });
    if (!blacklist) {
      throw new NotFoundException(`Blacklist entry with ID "${id}" not found`);
    }
    return blacklist;
  }

  /**
   * Supprimer un élément
   */
  async remove(id: string): Promise<void> {
    const blacklist = await this.findOne(id);
    await this.blacklistRepository.remove(blacklist);
  }

  /**
   * Vérifier si un email ou domaine est blacklisté
   */
  async isBlacklisted(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const domain = normalizedEmail.split('@')[1];

    // Vérifier email exact
    const emailBlacklisted = await this.blacklistRepository.findOne({
      where: { type: 'email', value: normalizedEmail, isActive: true },
    });

    if (emailBlacklisted) {
      return true;
    }

    // Vérifier domaine
    if (domain) {
      const domainBlacklisted = await this.blacklistRepository.findOne({
        where: { type: 'domain', value: domain, isActive: true },
      });
      return !!domainBlacklisted;
    }

    return false;
  }
}
