import {
  Injectable,
  ConflictException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePattern } from './role-pattern.entity';
import { CreateRolePatternDto } from './dto/create-role-pattern.dto';

@Injectable()
export class RoleAccountService implements OnModuleInit {
  /**
   * Patterns built-in (FR + EN)
   * Tous en lowercase / sans accents (email-friendly)
   */
  private readonly builtInPatterns = [
    // --- Génériques
    { pattern: 'info', description: 'Information email' },
    { pattern: 'contact', description: 'Contact email' },
    { pattern: 'support', description: 'Support email' },
    { pattern: 'help', description: 'Help email' },
    { pattern: 'admin', description: 'Administrator email' },
    { pattern: 'administrator', description: 'Administrator email' },
    { pattern: 'service', description: 'Service email' },
    { pattern: 'team', description: 'Team email' },
    { pattern: 'office', description: 'Office email' },
    { pattern: 'hello', description: 'Greeting email' },
    { pattern: 'hi', description: 'Greeting email' },

    // --- No-reply / automatisation
    { pattern: 'noreply', description: 'No-reply email' },
    { pattern: 'no-reply', description: 'No-reply email' },
    { pattern: 'donotreply', description: 'No-reply email' },
    { pattern: 'do-not-reply', description: 'No-reply email' },
    { pattern: 'mailer-daemon', description: 'Mail delivery subsystem' },
    { pattern: 'bounce', description: 'Bounce email' },
    { pattern: 'bounces', description: 'Bounce email' },
    { pattern: 'newsletter', description: 'Newsletter email' },
    { pattern: 'newsletters', description: 'Newsletter email' },

    // --- RFC / infra
    { pattern: 'webmaster', description: 'Webmaster email' },
    { pattern: 'postmaster', description: 'Postmaster email' },
    { pattern: 'hostmaster', description: 'Hostmaster email' },

    // --- Commercial / ventes
    { pattern: 'sales', description: 'Sales email' },
    { pattern: 'commercial', description: 'Commercial email' },
    { pattern: 'business', description: 'Business email' },
    { pattern: 'partners', description: 'Partners email' },
    { pattern: 'partnership', description: 'Partnership email' },
    { pattern: 'pricing', description: 'Pricing email' },
    { pattern: 'quote', description: 'Quote email' },
    { pattern: 'quotes', description: 'Quotes email' },

    // --- Support / SAV (FR)
    { pattern: 'sav', description: 'Service apres-vente' },
    { pattern: 'assistance', description: 'Assistance' },
    { pattern: 'aide', description: 'Aide' },
    { pattern: 'depannage', description: 'Depannage' },
    { pattern: 'reclamation', description: 'Reclamation' },
    { pattern: 'reclamations', description: 'Reclamations' },
    { pattern: 'litige', description: 'Litige' },
    { pattern: 'litiges', description: 'Litiges' },
    { pattern: 'retour', description: 'Retour' },
    { pattern: 'retours', description: 'Retours' },

    // --- Accueil / standard
    { pattern: 'accueil', description: 'Accueil' },
    { pattern: 'standard', description: 'Standard' },
    { pattern: 'secretariat', description: 'Secretariat' },
    { pattern: 'direction', description: 'Direction' },
    { pattern: 'management', description: 'Management' },
    { pattern: 'contacteznous', description: 'Contactez-nous' },

    // --- Comptabilite / finance (FR)
    { pattern: 'compta', description: 'Comptabilite' },
    { pattern: 'comptabilite', description: 'Comptabilite' },
    { pattern: 'facturation', description: 'Facturation' },
    { pattern: 'facture', description: 'Facture' },
    { pattern: 'factures', description: 'Factures' },
    { pattern: 'paiement', description: 'Paiement' },
    { pattern: 'paiements', description: 'Paiements' },
    { pattern: 'recouvrement', description: 'Recouvrement' },
    { pattern: 'tresorerie', description: 'Tresorerie' },
    { pattern: 'billing', description: 'Billing email' },
    { pattern: 'accounts', description: 'Accounts email' },
    { pattern: 'finance', description: 'Finance email' },

    // --- RH
    { pattern: 'rh', description: 'Ressources humaines' },
    { pattern: 'hr', description: 'Human Resources email' },
    { pattern: 'recrutement', description: 'Recrutement' },
    { pattern: 'candidature', description: 'Candidature' },
    { pattern: 'candidatures', description: 'Candidatures' },
    { pattern: 'stage', description: 'Stage' },
    { pattern: 'stages', description: 'Stages' },
    { pattern: 'alternance', description: 'Alternance' },
    { pattern: 'careers', description: 'Careers email' },
    { pattern: 'jobs', description: 'Jobs email' },

    // --- Juridique / conformite
    { pattern: 'juridique', description: 'Juridique' },
    { pattern: 'legal', description: 'Legal email' },
    { pattern: 'rgpd', description: 'RGPD' },
    { pattern: 'dpo', description: 'DPO' },
    { pattern: 'conformite', description: 'Conformite' },
    { pattern: 'privacy', description: 'Privacy email' },
    { pattern: 'security', description: 'Security email' },
    { pattern: 'abuse', description: 'Abuse email' },

    // --- Achats / logistique
    { pattern: 'achat', description: 'Achat' },
    { pattern: 'achats', description: 'Achats' },
    { pattern: 'appro', description: 'Approvisionnement' },
    { pattern: 'logistique', description: 'Logistique' },
    { pattern: 'livraison', description: 'Livraison' },
    { pattern: 'livraisons', description: 'Livraisons' },
    { pattern: 'expedition', description: 'Expedition' },

    // --- IT / tech
    { pattern: 'it', description: 'IT' },
    { pattern: 'informatique', description: 'Informatique' },
    { pattern: 'tech', description: 'Technical email' },
    { pattern: 'engineering', description: 'Engineering' },
    { pattern: 'dev', description: 'Development' },
    { pattern: 'devops', description: 'DevOps' },

    // --- Communication
    { pattern: 'marketing', description: 'Marketing' },
    { pattern: 'communication', description: 'Communication' },
    { pattern: 'presse', description: 'Presse' },
    { pattern: 'press', description: 'Press' },
    { pattern: 'media', description: 'Media' },

    // --- Divers
    { pattern: 'qualite', description: 'Qualite' },
    { pattern: 'qse', description: 'QSE' },
    { pattern: 'rse', description: 'RSE' },
    { pattern: 'formation', description: 'Formation' },
    { pattern: 'evenement', description: 'Evenement' },
    { pattern: 'evenements', description: 'Evenements' },
    { pattern: 'enquiries', description: 'Enquiries email' },
    { pattern: 'inquiry', description: 'Inquiry email' },
    { pattern: 'feedback', description: 'Feedback email' },
  ];

  constructor(
    @InjectRepository(RolePattern)
    private readonly rolePatternRepository: Repository<RolePattern>,
  ) {}

  async onModuleInit() {
    await this.seedBuiltInPatterns();
  }

  private async seedBuiltInPatterns() {
    for (const builtIn of this.builtInPatterns) {
      const exists = await this.rolePatternRepository.findOne({
        where: { pattern: builtIn.pattern },
      });

      if (!exists) {
        const rolePattern = this.rolePatternRepository.create({
          pattern: builtIn.pattern,
          description: builtIn.description,
          isCustom: false,
          isActive: true,
        });
        await this.rolePatternRepository.save(rolePattern);
      }
    }
  }

  /**
   * Ajouter un pattern personnalisé
   */
  async create(createDto: CreateRolePatternDto): Promise<RolePattern> {
    const normalizedPattern = createDto.pattern.toLowerCase().trim();

    const existing = await this.rolePatternRepository.findOne({
      where: { pattern: normalizedPattern },
    });

    if (existing) {
      throw new ConflictException(
        `Pattern "${normalizedPattern}" already exists`,
      );
    }

    const rolePattern = this.rolePatternRepository.create({
      pattern: normalizedPattern,
      description: createDto.description,
      isCustom: createDto.isCustom ?? true,
      isActive: true,
    });

    return this.rolePatternRepository.save(rolePattern);
  }

  /**
   * Lister tous les patterns
   */
  async findAll(): Promise<RolePattern[]> {
    return this.rolePatternRepository.find({
      where: { isActive: true },
      order: { pattern: 'ASC' },
    });
  }

  /**
   * Trouver un pattern par ID
   */
  async findOne(id: string): Promise<RolePattern> {
    const pattern = await this.rolePatternRepository.findOne({ where: { id } });
    if (!pattern) {
      throw new NotFoundException(`Pattern with ID "${id}" not found`);
    }
    return pattern;
  }

  /**
   * Supprimer un pattern (seulement custom)
   */
  async remove(id: string): Promise<void> {
    const pattern = await this.findOne(id);

    if (!pattern.isCustom) {
      throw new ConflictException(
        'Cannot delete built-in pattern. Deactivate it instead.',
      );
    }

    await this.rolePatternRepository.remove(pattern);
  }

  /**
   * Désactiver un pattern
   */
  async deactivate(id: string): Promise<RolePattern> {
    const pattern = await this.findOne(id);
    pattern.isActive = false;
    return this.rolePatternRepository.save(pattern);
  }

  /**
   * Réactiver un pattern
   */
  async activate(id: string): Promise<RolePattern> {
    const pattern = await this.findOne(id);
    pattern.isActive = true;
    return this.rolePatternRepository.save(pattern);
  }

  /**
   * Détecter si un email est un role account
   * 
   * Détection en 3 niveaux:
   * 1. Match exact (confidence: 1.0)
   * 2. Match par token (confidence: 0.95)
   * 3. Match partiel pour patterns >= 4 chars (confidence: 0.7)
   */
  async isRoleAccount(email: string): Promise<{
    isRole: boolean;
    pattern?: string;
    confidence: number;
  }> {
    const normalizedEmail = email.toLowerCase().trim();
    const localPartRaw = normalizedEmail.split('@')[0];

    // Normalisation FR-friendly
    const localPart = localPartRaw
      .replace(/_/g, '-')     // contact_fr → contact-fr
      .replace(/\d+$/g, '')   // facturation2024 → facturation
      .trim();

    // Tokenisation (sépare par -, ., +)
    const tokens = localPart.split(/[-.+]/g).filter(Boolean);

    // Récupérer les patterns actifs
    const patterns = await this.rolePatternRepository.find({
      where: { isActive: true },
    });

    // 1. Match exact (confidence: 1.0)
    for (const pattern of patterns) {
      if (localPart === pattern.pattern) {
        return {
          isRole: true,
          pattern: pattern.pattern,
          confidence: 1.0,
        };
      }
    }

    // 2. Match par token (confidence: 0.95)
    // Ex: info-fr → tokens: [info, fr] → match "info"
    for (const pattern of patterns) {
      if (tokens.includes(pattern.pattern)) {
        return {
          isRole: true,
          pattern: pattern.pattern,
          confidence: 0.95,
        };
      }
    }

    // 3. Match partiel (confidence: 0.7)
    // Ex: serviceclient → match "service"
    // SEULEMENT pour patterns >= 4 chars (évite faux positifs: smith → it)
    for (const pattern of patterns) {
      if (
        pattern.pattern.length >= 4 &&
        localPart.includes(pattern.pattern)
      ) {
        return {
          isRole: true,
          pattern: pattern.pattern,
          confidence: 0.7,
        };
      }
    }

    return {
      isRole: false,
      confidence: 0,
    };
  }
}
