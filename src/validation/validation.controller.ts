import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ValidationService } from './validation.service';

@Controller('api/v1/validate')
export class ValidationController {
  constructor(private readonly validationService: ValidationService) {}

  /**
   * POST /api/v1/validate
   * Validation complète d'un email
   */
  @Post()
  async validateEmail(@Body() body: { email: string }) {
    return this.validationService.validateEmail(body.email);
  }

  /**
   * POST /api/v1/validate/syntax
   * Validation syntaxe uniquement
   */
  @Post('syntax')
  validateSyntax(@Body() body: { email: string }) {
    return this.validationService.validateSyntax(body.email);
  }

  /**
   * POST /api/v1/validate/dns
   * Validation DNS uniquement
   */
  @Post('dns')
  async validateDNS(@Body() body: { email: string }) {
    return this.validationService.validateDNS(body.email);
  }

  /**
   * GET /api/v1/validate/test
   * Endpoint de test simple
   */
  @Get('test')
  test() {
    return {
      message: 'Validation API is working! 🚀',
      version: '1.0',
      endpoints: [
        'POST /api/v1/validate',
        'POST /api/v1/validate/syntax',
        'POST /api/v1/validate/dns',
      ],
    };
  }
}
