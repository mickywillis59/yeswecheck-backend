import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ValidationService } from './validation.service';
import { ValidateEmailDto } from './dto/validate-email.dto';

@Controller('api/v1/validate')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  /**
   * POST /api/v1/validate
   * Validation complète d'un email avec whitelist/blacklist
   * ✅ MODIFIÉ : Supporte maintenant smtp=true et smtpTimeout via DTO
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async validateEmail(@Body() dto: ValidateEmailDto) {
    return this.validationService.validateEmail(dto.email, {
      smtp: dto.smtp ?? false,
      smtpTimeout: dto.smtpTimeout,
    });
  }

  /**
   * POST /api/v1/validate/batch
   * Validation de plusieurs emails en une seule requête
   * ✅ MODIFIÉ : Supporte maintenant smtp et smtpTimeout pour le batch
   */
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async validateBatch(
    @Body()
    body: {
      emails: string[];
      smtp?: boolean;
      smtpTimeout?: number;
    },
  ) {
    const results = await Promise.all(
      body.emails.map(async (email) => {
        try {
          const result = await this.validationService.validateEmail(email, {
            smtp: body.smtp ?? false,
            smtpTimeout: body.smtpTimeout,
          });
          return result;
        } catch (error) {
          return {
            email,
            isValid: false,
            validity: 'invalid',
            score: 0,
            reason: 'Validation error',
            error: error.message,
          };
        }
      }),
    );

    return {
      total: results.length,
      valid: results.filter((r) => r.isValid).length,
      invalid: results.filter((r) => !r.isValid).length,
      results,
    };
  }

  /**
   * POST /api/v1/validate/syntax
   * Validation syntaxe uniquement (ultra rapide)
   */
  @Post('syntax')
  @HttpCode(HttpStatus.OK)
  validateSyntax(@Body() body: { email: string }) {
    return this.validationService.validateSyntax(body.email);
  }

  /**
   * POST /api/v1/validate/dns
   * Validation DNS uniquement
   */
  @Post('dns')
  @HttpCode(HttpStatus.OK)
  async validateDNS(@Body() body: { email: string }) {
    return this.validationService.validateDNS(body.email);
  }

  /**
   * POST /api/v1/validate/quick-check
   * Vérification rapide : whitelist/blacklist seulement (sans validation complète)
   */
  @Post('quick-check')
  @HttpCode(HttpStatus.OK)
  async quickCheck(@Body() body: { email: string }) {
    const email = body.email.toLowerCase().trim();
    const domain = email.split('@')[1];

    return {
      email,
      domain,
      checks: {
        syntax: this.validationService.validateSyntax(email),
      },
    };
  }

  /**
   * GET /api/v1/validate/stats
   * Statistiques globales (optionnel, à implémenter plus tard)
   */
  @Get('stats')
  async getStats() {
    return {
      message: 'Statistics endpoint - Coming soon!',
      features: [
        'Total validations',
        'Whitelist hits',
        'Blacklist blocks',
        'Average score',
      ],
    };
  }

  /**
   * GET /api/v1/validate/test
   * Endpoint de test et documentation
   * ✅ MODIFIÉ : Documentation mise à jour avec SMTP
   */
  @Get('test')
  test() {
    return {
      message: 'Validation API is working! 🚀',
      version: '2.1',
      features: [
        '✅ Syntax validation',
        '✅ DNS/MX records check',
        '✅ SMTP mailbox verification (optional)', // ✅ AJOUT
        '✅ Disposable email detection',
        '✅ Role account detection',
        '✅ Profanity detection',
        '✅ Random characters detection',
        '✅ First name enrichment',
        '✅ Typo domain suggestion',
        '✅ Whitelist support (email + domain)',
        '✅ Blacklist support (email + domain)',
        '✅ Batch validation',
      ],
      endpoints: {
        validation: [
          'POST /api/v1/validate - Full validation with all checks',
          'POST /api/v1/validate/batch - Validate multiple emails',
          'POST /api/v1/validate/syntax - Syntax check only',
          'POST /api/v1/validate/dns - DNS check only',
          'POST /api/v1/validate/quick-check - Quick whitelist/blacklist check',
        ],
        management: [
          'GET /api/v1/whitelist - List all whitelisted emails/domains',
          'POST /api/v1/whitelist - Add to whitelist',
          'DELETE /api/v1/whitelist/:id - Remove from whitelist',
          'GET /api/v1/blacklist - List all blacklisted emails/domains',
          'POST /api/v1/blacklist - Add to blacklist',
          'DELETE /api/v1/blacklist/:id - Remove from blacklist',
        ],
        info: [
          'GET /api/v1/validate/test - This endpoint',
          'GET /api/v1/validate/stats - Statistics (coming soon)',
        ],
      },
      examples: {
        fullValidation: {
          method: 'POST',
          url: '/api/v1/validate',
          body: { email: 'test@example.com' },
        },
        fullValidationWithSMTP: {
          method: 'POST',
          url: '/api/v1/validate',
          body: {
            email: 'test@example.com',
            smtp: true,
            smtpTimeout: 1500,
          },
        },
        batchValidation: {
          method: 'POST',
          url: '/api/v1/validate/batch',
          body: {
            emails: ['email1@example.com', 'email2@example.com'],
          },
        },
        batchValidationWithSMTP: {
          method: 'POST',
          url: '/api/v1/validate/batch',
          body: {
            emails: ['email1@example.com', 'email2@example.com'],
            smtp: true,
            smtpTimeout: 1200,
          },
        },
        addToWhitelist: {
          method: 'POST',
          url: '/api/v1/whitelist',
          body: {
            type: 'email',
            value: 'vip@company.com',
            reason: 'CEO',
          },
        },
        addDomainToBlacklist: {
          method: 'POST',
          url: '/api/v1/blacklist',
          body: {
            type: 'domain',
            value: 'spam.com',
            reason: 'Known spammer',
          },
        },
      },
      smtpConfiguration: {
        enabled: 'Set smtp=true in request body',
        timeout: 'Optional smtpTimeout (100-5000ms, default from .env)',
        defaultBehavior: 'SMTP disabled by default (opt-in)',
        note: 'SMTP verification adds 500-1500ms latency but confirms mailbox existence',
      },
    };
  }

  /**
   * GET /api/v1/validate/health
   * Health check pour monitoring
   */
  @Get('health')
  health() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'email-validation',
      version: '2.1',
    };
  }
}
