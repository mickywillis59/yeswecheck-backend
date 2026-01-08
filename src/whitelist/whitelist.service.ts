import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Whitelist } from './whitelist.entity';
import { CreateWhitelistDto } from './dto/create-whitelist.dto';

@Injectable()
export class WhitelistService {
  constructor(
    @InjectRepository(Whitelist)
    private whitelistRepository: Repository<Whitelist>,
  ) {}

  /**
   * Ajouter un email ou domaine à la whitelist
   */
  async create(createDto: CreateWhitelistDto): Promise<Whitelist> {
    // Normaliser la valeur (lowercase)
    const normalizedValue = createDto.value.toLowerCase().trim();

    // Vérifier si existe déjà
    const existing = await this.whitelistRepository.findOne({
      where: { value: normalizedValue },
    });

    if (existing) {
      throw new ConflictException(
        `${createDto.type} "${normalizedValue}" is already in whitelist`,
      );
    }

    // Créer l'entrée
    const whitelist = this.whitelistRepository.create({
      type: createDto.type,
      value: normalizedValue,
      reason: createDto.reason,
    });

    return this.whitelistRepository.save(whitelist);
  }

  /**
   * Lister tous les éléments de la whitelist
   */
  async findAll(type?: 'domain' | 'email'): Promise<Whitelist[]> {
    if (type) {
      return this.whitelistRepository.find({
        where: { type, isActive: true },
        order: { createdAt: 'DESC' },
      });
    }
    return this.whitelistRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Trouver un élément par ID
   */
  async findOne(id: string): Promise<Whitelist> {
    const whitelist = await this.whitelistRepository.findOne({ where: { id } });
    if (!whitelist) {
      throw new NotFoundException(`Whitelist entry with ID "${id}" not found`);
    }
    return whitelist;
  }

  /**
   * Supprimer un élément
   */
  async remove(id: string): Promise<void> {
    const whitelist = await this.findOne(id);
    await this.whitelistRepository.remove(whitelist);
  }

  /**
   * Vérifier si un email ou domaine est whitelisté
   */
  async isWhitelisted(email: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();
    const domain = normalizedEmail.split('@')[1];

    // Vérifier email exact
    const emailWhitelisted = await this.whitelistRepository.findOne({
      where: { type: 'email', value: normalizedEmail, isActive: true },
    });

    if (emailWhitelisted) {
      return true;
    }

    // Vérifier domaine
    if (domain) {
      const domainWhitelisted = await this.whitelistRepository.findOne({
        where: { type: 'domain', value: domain, isActive: true },
      });
      return !!domainWhitelisted;
    }

    return false;
  }
}
