import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ProfanityService } from './profanity.service';
import { CreateProfanityDto } from './dto/create-profanity.dto';

@Controller('api/v1/profanity')
export class ProfanityController {
  constructor(private readonly profanityService: ProfanityService) {}

  /**
   * POST /api/v1/profanity
   * Ajouter un mot manuellement
   */
  @Post()
  create(@Body() createDto: CreateProfanityDto) {
    return this.profanityService.create(createDto);
  }

  /**
   * GET /api/v1/profanity
   * Lister tous les mots (optionnel:  filtrer par langue)
   */
  @Get()
  findAll(@Query('language') language?: string) {
    return this.profanityService.findAll(language);
  }

  /**
   * GET /api/v1/profanity/count
   * Compter les mots
   */
  @Get('count')
  count(@Query('language') language?: string) {
    return this.profanityService.count(language);
  }

  /**
   * GET /api/v1/profanity/:id
   * Récupérer un mot par ID
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.profanityService.findOne(id);
  }

  /**
   * DELETE /api/v1/profanity/:id
   * Supprimer un mot
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.profanityService.remove(id);
  }

  /**
   * PATCH /api/v1/profanity/:id/deactivate
   * Désactiver un mot
   */
  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) {
    return this.profanityService.deactivate(id);
  }

  /**
   * PATCH /api/v1/profanity/:id/activate
   * Réactiver un mot
   */
  @Patch(':id/activate')
  activate(@Param('id') id: string) {
    return this.profanityService.activate(id);
  }

  /**
   * POST /api/v1/profanity/check
   * Vérifier si un email contient des gros mots
   */
  @Post('check')
  async check(@Body() body: { email: string }) {
    const result = await this.profanityService.checkProfanity(body.email);
    return {
      email: body.email,
      ...result,
    };
  }

  /**
   * POST /api/v1/profanity/import
   * Import bulk depuis liste externe
   */
  @Post('import')
  async importBulk(
    @Body()
    body: {
      words: string[];
      language: string;
      severity?: 'low' | 'medium' | 'high';
      source?: string;
    },
  ) {
    return this.profanityService.importBulk(body);
  }

  /**
   * POST /api/v1/profanity/reload-redis
   * Recharger Redis manuellement
   */
  @Post('reload-redis')
  async reloadRedis() {
    await this.profanityService.reloadRedis();
    return { message: 'Redis reloaded successfully' };
  }
}
