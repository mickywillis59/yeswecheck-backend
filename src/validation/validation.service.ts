import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';
import { DisposableEmailService } from '../disposable-email/disposable-email.service';
import { RoleAccountService } from '../role-account/role-account.service';
import { WhitelistService } from '../whitelist/whitelist.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import { ProfanityService } from '../profanity/profanity.service';

const resolveMx = promisify(dns. resolveMx);

@Injectable()
export class ValidationService {
  constructor(
    private readonly disposableEmailService: DisposableEmailService,
    private readonly roleAccountService: RoleAccountService,
    private readonly whitelistService:  WhitelistService,
    private readonly blacklistService: BlacklistService,
    private readonly profanityService: ProfanityService,
  ) {}

  /**
   * Validation syntaxe uniquement
   */
  validateSyntax(email: string): {
    isValid: boolean;
    message: string;
    score: number;
  } {
    if (! email || email.trim() === '') {
      return {
        isValid: false,
        message: 'Email cannot be empty',
        score: 0,
      };
    }

    const emailRegex = /^[a-zA-Z0-9.! #$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!emailRegex.test(email)) {
      return {
        isValid: false,
        message: 'Email syntax is invalid',
        score: 20,
      };
    }

    if (email.length > 254) {
      return {
        isValid: false,
        message: 'Email is too long (max 254 characters)',
        score: 10,
      };
    }

    return {
      isValid: true,
      message: 'Email syntax is valid',
      score: 100,
    };
  }

  /**
   * Validation DNS uniquement
   */
  async validateDNS(email: string): Promise<{
    isValid: boolean;
    message: string;
    score: number;
    mxRecords?:  any[];
  }> {
    const domain = email.split('@')[1];

    if (!domain) {
      return {
        isValid: false,
        message: 'Invalid email format (no domain)',
        score: 0,
      };
    }

    try {
      const mxRecords = await resolveMx(domain);

      if (mxRecords && mxRecords.length > 0) {
        return {
          isValid: true,
          message: `Domain ${domain} has valid MX records`,
          score: 100,
          mxRecords:  mxRecords. map(r => ({ exchange: r.exchange, priority: r.priority })),
        };
      } else {
        return {
          isValid: false,
          message: `Domain ${domain} has no MX records`,
          score: 50,
        };
      }
    } catch (error) {
      return {
        isValid:  false,
        message: `Domain ${domain} does not exist or is unreachable`,
        score: 30,
      };
    }
  }

  /**
   * Validation complète d'un email
   */
  async validateEmail(email: string): Promise<any> {
    const startTime = Date.now();

    // ÉTAPE 0 : Validation syntaxe basique
    const syntaxResult = this.validateSyntax(email);

    if (!syntaxResult.isValid) {
      return {
        email,
        isValid: false,
        score: syntaxResult.score,
        reason: syntaxResult.message,
        executionTime: Date.now() - startTime,
        risk: {
          profanity:  'none',
          overall:  'high',
        },
        details:  {
          syntax: syntaxResult,
        },
      };
    }

    // ÉTAPE 1 : Vérification WHITELIST (bypass tout)
    const whitelistCheck = await this.whitelistService.isWhitelisted(email);

    if (whitelistCheck) {
      return {
        email,
        isValid: true,
        score: 100,
        reason: 'Email is whitelisted (trusted)',
        executionTime: Date.now() - startTime,
        risk: {
          profanity: 'none',
          overall: 'none',
        },
        details: {
          syntax: syntaxResult,
          whitelist: {
            isWhitelisted: true,
            message: 'This email or domain is in your whitelist and bypasses all validation checks',
          },
        },
      };
    }

    // ÉTAPE 2 :  Vérification BLACKLIST (rejet immédiat)
    const blacklistCheck = await this.blacklistService.isBlacklisted(email);

    if (blacklistCheck) {
      return {
        email,
        isValid: false,
        score: 0,
        reason: 'Email is blacklisted',
        executionTime: Date.now() - startTime,
        risk: {
          profanity: 'none',
          overall: 'high',
        },
        details:  {
          syntax: syntaxResult,
          whitelist: { isWhitelisted: false },
          blacklist: {
            isBlacklisted:  true,
            message: 'This email or domain is in your blacklist and has been blocked',
          },
        },
      };
    }

    // ÉTAPE 3 :  Détection PROFANITÉ (flagging seulement, pas de rejet)
    const profanityCheck = await this.profanityService.checkProfanity(email);

    // Calculer la pénalité de score selon la sévérité
    let profanityPenalty = 0;
    let profanityRisk = 'none';

    if (profanityCheck.hasProfanity) {
      if (profanityCheck.severity === 'high') {
        profanityPenalty = 50;
        profanityRisk = 'high';
      } else if (profanityCheck.severity === 'medium') {
        profanityPenalty = 30;
        profanityRisk = 'medium';
      } else if (profanityCheck.severity === 'low') {
        profanityPenalty = 10;
        profanityRisk = 'low';
      }
    }

    // ÉTAPE 4 : Pipeline de validation NORMAL

    // 4a. Vérification email jetable
    const disposableCheck = await this.disposableEmailService. isDisposable(email);

    if (disposableCheck. isDisposable) {
      // Calculer score avec pénalité profanité
      const finalScore = Math.max(0, 0 - profanityPenalty);
      
      return {
        email,
        isValid: false,
        score: finalScore,
        reason: 'Disposable email address detected',
        executionTime: Date.now() - startTime,
        risk: {
          profanity: profanityRisk,
          overall: 'high',
        },
        details:  {
          syntax: syntaxResult,
          whitelist: { isWhitelisted: false },
          blacklist: { isBlacklisted: false },
          profanity: {
            ... profanityCheck,
            risk: profanityRisk,
            penalty: profanityPenalty,
            message: profanityCheck.hasProfanity
              ? '⚠️ This email contains potentially inappropriate language.  Could be legitimate (real name) or intentional.'
              : 'No inappropriate language detected',
          },
          disposable: {
            ... disposableCheck,
            message: 'This domain is identified as a temporary/disposable email provider',
          },
        },
      };
    }

    // 4b. Vérification compte à rôle
    const roleCheck = await this.roleAccountService.isRoleAccount(email);

    if (roleCheck.isRole) {
      // Calculer score avec pénalité profanité
      const baseScore = 20;
      const finalScore = Math.max(0, baseScore - profanityPenalty);
      
      return {
        email,
        isValid: true,
        score: finalScore,
        reason: 'Role account detected',
        executionTime:  Date.now() - startTime,
        risk: {
          profanity: profanityRisk,
          overall: this.calculateOverallRisk(finalScore, profanityRisk, false, true),
        },
        details:  {
          syntax: syntaxResult,
          whitelist: { isWhitelisted: false },
          blacklist: { isBlacklisted: false },
          profanity: {
            ...profanityCheck,
            risk: profanityRisk,
            penalty: profanityPenalty,
            message: profanityCheck.hasProfanity
              ? '⚠️ This email contains potentially inappropriate language. Could be legitimate (real name) or intentional.'
              : 'No inappropriate language detected',
          },
          disposable: disposableCheck,
          roleAccount: {
            ...roleCheck,
            message: 'This email uses a generic role-based address (e.g., info@, contact@, admin@)',
          },
        },
      };
    }

    // 4c. Validation DNS
    const dnsResult = await this.validateDNS(email);

    // 4d. Calcul du score final
    let finalScore = Math.round((syntaxResult.score + dnsResult.score) / 2);

    // Appliquer la pénalité profanité
    finalScore = Math.max(0, finalScore - profanityPenalty);

    // Calculer le risque global
    const overallRisk = this.calculateOverallRisk(
      finalScore,
      profanityRisk,
      disposableCheck. isDisposable,
      roleCheck.isRole
    );

    return {
      email,
      isValid: dnsResult.isValid,
      score: finalScore,
      reason: dnsResult.isValid ? 'Email appears valid' : dnsResult.message,
      executionTime: Date.now() - startTime,
      risk: {
        profanity: profanityRisk,
        overall:  overallRisk,
      },
      details: {
        syntax: syntaxResult,
        whitelist: { isWhitelisted:  false },
        blacklist: { isBlacklisted: false },
        profanity: {
          ...profanityCheck,
          risk: profanityRisk,
          penalty: profanityPenalty,
          message:  profanityCheck.hasProfanity
            ? '⚠️ This email contains potentially inappropriate language. Could be legitimate (real name) or intentional.'
            :  'No inappropriate language detected',
        },
        dns: dnsResult,
        disposable: disposableCheck,
        roleAccount: roleCheck,
      },
    };
  }

  /**
   * Calculer le niveau de risque global
   */
  private calculateOverallRisk(
    score: number,
    profanityRisk: string,
    isDisposable: boolean,
    isRole: boolean
  ): string {
    // Score < 30 = Risque élevé
    if (score < 30 || profanityRisk === 'high') {
      return 'high';
    }

    // Score < 60 ou profanité medium ou disposable = Risque moyen
    if (score < 60 || profanityRisk === 'medium' || isDisposable) {
      return 'medium';
    }

    // Score < 80 ou role account = Risque faible
    if (score < 80 || profanityRisk === 'low' || isRole) {
      return 'low';
    }

    // Sinon = Aucun risque
    return 'none';
  }
}