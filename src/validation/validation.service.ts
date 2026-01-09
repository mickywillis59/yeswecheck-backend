import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';
import { DisposableEmailService } from '../disposable-email/disposable-email.service';
import { RoleAccountService } from '../role-account/role-account.service';
import { WhitelistService } from '../whitelist/whitelist.service';
import { BlacklistService } from '../blacklist/blacklist.service';
import { ProfanityService } from '../profanity/profanity.service';
import { RandomDetectionService } from '../random-detection/random-detection.service';

const resolveMx = promisify(dns. resolveMx);

@Injectable()
export class ValidationService {
  constructor(
    private readonly disposableEmailService: DisposableEmailService,
    private readonly roleAccountService: RoleAccountService,
    private readonly whitelistService:  WhitelistService,
    private readonly blacklistService: BlacklistService,
    private readonly profanityService: ProfanityService,
    private readonly randomDetectionService: RandomDetectionService,
  ) {}

  /**
   * Validation syntaxe uniquement
   */
  validateSyntax(email: string): {
    isValid: boolean;
    message: string;
    score: number;
  } {
    if (!email || email.trim() === '') {
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
          mxRecords:  mxRecords. map(r => ({ exchange: r. exchange, priority: r.priority })),
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
   * 
   * LOGIQUE : 
   * - isValid = true SI ET SEULEMENT SI syntax + DNS sont OK
   * - Profanity, Disposable, Role, Random = FLAGS informatifs (réduisent le score mais n'invalident pas)
   * - Seuls Syntax, DNS, Blacklist peuvent mettre isValid = false
   */
  async validateEmail(email:  string): Promise<any> {
    const startTime = Date.now();

    // ========== ÉTAPE 0 : Validation syntaxe ==========
    const syntaxResult = this.validateSyntax(email);

    if (!syntaxResult.isValid) {
      return {
        email,
        isValid: false,
        score: syntaxResult.score,
        reason: syntaxResult.message,
        executionTime: `${Date.now() - startTime}ms`,
        risk: {
          profanity: 'none',
          overall: 'high',
        },
        details: {
          syntax: syntaxResult,
        },
      };
    }

    // ========== ÉTAPE 1 : Whitelist (bypass tout) ==========
    const whitelistCheck = await this.whitelistService.isWhitelisted(email);

    if (whitelistCheck) {
      return {
        email,
        isValid: true,
        score: 100,
        reason: 'Email is whitelisted (trusted)',
        executionTime: `${Date.now() - startTime}ms`,
        risk: {
          profanity: 'none',
          overall: 'none',
        },
        details:  {
          syntax: syntaxResult,
          whitelist: {
            isWhitelisted: true,
            message: 'This email or domain is in your whitelist and bypasses all validation checks',
          },
        },
      };
    }

    // ========== ÉTAPE 2 : Blacklist (rejet immédiat) ==========
    const blacklistCheck = await this.blacklistService.isBlacklisted(email);

    if (blacklistCheck) {
      return {
        email,
        isValid: false,
        score: 0,
        reason: 'Email is blacklisted',
        executionTime: `${Date.now() - startTime}ms`,
        risk: {
          profanity: 'none',
          overall: 'high',
        },
        details: {
          syntax: syntaxResult,
          whitelist: { isWhitelisted: false },
          blacklist: {
            isBlacklisted: true,
            message: 'This email or domain is in your blacklist and has been blocked',
          },
        },
      };
    }

    // ========== ÉTAPE 3 : Validation DNS (BLOQUANT) ==========
    const dnsResult = await this.validateDNS(email);

    if (!dnsResult.isValid) {
      return {
        email,
        isValid: false,
        score: dnsResult.score,
        reason: dnsResult. message,
        executionTime:  `${Date.now() - startTime}ms`,
        risk: {
          profanity: 'none',
          overall: 'high',
        },
        details: {
          syntax: syntaxResult,
          whitelist: { isWhitelisted:  false },
          blacklist: { isBlacklisted: false },
          dns: dnsResult,
        },
      };
    }

    // ========== À CE STADE :  Email VALIDE (syntax + DNS OK) ==========
    // Les checks suivants sont des FLAGS informatifs

    // ========== ÉTAPE 4 : Collecte des FLAGS ==========

    // 4a. Profanity check (FLAG)
    const profanityCheck = await this.profanityService.checkProfanity(email);

    // 4b. Disposable check (FLAG)
    const disposableCheck = await this.disposableEmailService.isDisposable(email);

    // 4c. Role account check (FLAG)
    const roleCheck = await this.roleAccountService.isRoleAccount(email);

    // 4d. Random detection check (FLAG)
    const randomCheck = await this.randomDetectionService.checkEmail(email);

    // ========== ÉTAPE 5 : Calcul du score ==========
    let finalScore = 100; // On part de 100

    // Pénalité profanité
    let profanityPenalty = 0;
    let profanityRisk = 'none';

    if (profanityCheck. hasProfanity) {
      if (profanityCheck.severity === 'high') {
        profanityPenalty = 40;
        profanityRisk = 'high';
      } else if (profanityCheck. severity === 'medium') {
        profanityPenalty = 25;
        profanityRisk = 'medium';
      } else if (profanityCheck.severity === 'low') {
        profanityPenalty = 10;
        profanityRisk = 'low';
      }
      finalScore -= profanityPenalty;
    }

    // Pénalité disposable
    if (disposableCheck.isDisposable) {
      finalScore -= 30;
    }

    // Pénalité role account
    if (roleCheck.isRole) {
      finalScore -= 15;
    }

    // Pénalité random detection
    if (randomCheck.isRandom) {
      if (randomCheck.score >= 80) {
        finalScore -= 25;
      } else if (randomCheck.score >= 60) {
        finalScore -= 15;
      } else {
        finalScore -= 5;
      }
    }

    // Score minimum = 0
    finalScore = Math.max(0, finalScore);

    // ========== ÉTAPE 6 : Calcul du risque global ==========
    const overallRisk = this.calculateOverallRisk(
      finalScore,
      profanityRisk,
      disposableCheck. isDisposable,
      roleCheck.isRole,
      randomCheck.isRandom,
    );

    // ========== ÉTAPE 7 : Construction du résultat ==========
    return {
      email,
      isValid: true, // ✅ VALIDE car syntax + DNS OK
      score: finalScore,
      reason: this.buildReasonMessage(
        profanityCheck.hasProfanity,
        disposableCheck.isDisposable,
        roleCheck.isRole,
        randomCheck.isRandom,
      ),
      executionTime: `${Date.now() - startTime}ms`,
      risk: {
        profanity: profanityRisk,
        overall:  overallRisk,
      },
      details: {
        syntax: syntaxResult,
        dns: dnsResult,
        whitelist: { isWhitelisted:  false },
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
          ...disposableCheck,
          message: disposableCheck.isDisposable
            ? '⚠️ This domain is identified as a temporary/disposable email provider'
            : 'Not a disposable email domain',
        },
        roleAccount: {
          ...roleCheck,
          message: roleCheck. isRole
            ? '⚠️ This email uses a generic role-based address (e.g., info@, contact@, admin@)'
            : 'Not a role-based account',
        },
        randomDetection: {
          ...randomCheck,
          message: randomCheck. isRandom
            ? '⚠️ Email local part appears to contain random/generated characters'
            : 'Email local part appears normal',
        },
      },
    };
  }

  /**
   * Construire le message de raison
   */
  private buildReasonMessage(
    hasProfanity: boolean,
    isDisposable: boolean,
    isRole: boolean,
    isRandom: boolean,
  ): string {
    const flags:  string[] = [];

    if (hasProfanity) flags.push('profanity detected');
    if (isDisposable) flags.push('disposable domain');
    if (isRole) flags.push('role account');
    if (isRandom) flags.push('random characters detected');

    if (flags.length === 0) {
      return 'Email is valid with high quality';
    }

    return `Email is valid but has warnings: ${flags.join(', ')}`;
  }

  /**
   * Calculer le niveau de risque global
   */
  private calculateOverallRisk(
    score: number,
    profanityRisk: string,
    isDisposable: boolean,
    isRole: boolean,
    isRandom: boolean,
  ): string {
    // Score < 40 = Risque élevé
    if (score < 40 || profanityRisk === 'high') {
      return 'high';
    }

    // Score < 70 ou disposable/profanité medium/random = Risque moyen
    if (score < 70 || profanityRisk === 'medium' || isDisposable || isRandom) {
      return 'medium';
    }

    // Score < 85 ou role/profanité low = Risque faible
    if (score < 85 || profanityRisk === 'low' || isRole) {
      return 'low';
    }

    // Sinon = Aucun risque
    return 'none';
  }
}