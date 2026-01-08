import { Injectable } from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';
import { DisposableEmailService } from '../disposable-email/disposable-email.service';
import { RoleAccountService } from '../role-account/role-account.service';

const resolveMx = promisify(dns.resolveMx);

@Injectable()
export class ValidationService {
  constructor(
    private readonly disposableEmailService: DisposableEmailService,
    private readonly roleAccountService: RoleAccountService,
  ) {}

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

    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

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

  async validateDNS(email: string): Promise<{
    isValid: boolean;
    message: string;
    score: number;
    mxRecords?: any[];
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
          mxRecords: mxRecords.map(r => ({ exchange: r.exchange, priority: r.priority })),
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
        isValid: false,
        message: `Domain ${domain} does not exist or is unreachable`,
        score: 30,
      };
    }
  }

  async validateEmail(email: string): Promise<any> {
    const startTime = Date.now();

    // 1. Validation syntaxe
    const syntaxResult = this.validateSyntax(email);

    if (!syntaxResult.isValid) {
      return {
        email,
        isValid: false,
        score: syntaxResult.score,
        reason: syntaxResult.message,
        executionTime: Date.now() - startTime,
        details: {
          syntax: syntaxResult,
        },
      };
    }

    // 2. Vérification email jetable
    const disposableCheck = await this.disposableEmailService.isDisposable(email);
    
    if (disposableCheck.isDisposable) {
      return {
        email,
        isValid: false,
        score: 0,
        reason: 'Disposable email address detected',
        executionTime: Date.now() - startTime,
        details: {
          syntax: syntaxResult,
          disposable: {
            ...disposableCheck,
            message: 'This domain is identified as a temporary/disposable email provider'
          },
        },
      };
    }

    // 3. Vérification compte à rôle (NOUVEAU)
    const roleCheck = await this.roleAccountService.isRoleAccount(email);
    
    if (roleCheck.isRole) {
      return {
        email,
        isValid: true,
        score: 20,
        reason: 'Role account detected',
        executionTime: Date.now() - startTime,
        details: {
          syntax: syntaxResult,
          disposable: disposableCheck,
          roleAccount: {
            ...roleCheck,
            message: 'This email uses a generic role-based address (e.g., info@, contact@, admin@)'
          },
        },
      };
    }

    // 4. Validation DNS
    const dnsResult = await this.validateDNS(email);

    // 5. Calcul du score final
    const finalScore = Math.round((syntaxResult.score + dnsResult.score) / 2);

    return {
      email,
      isValid: dnsResult.isValid,
      score: finalScore,
      reason: dnsResult.isValid 
        ? 'Email appears valid' 
        : dnsResult.message,
      executionTime: Date.now() - startTime,
      details: {
        syntax: syntaxResult,
        dns: dnsResult,
        disposable: disposableCheck,
        roleAccount: roleCheck,
      },
    };
  }
}
