import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { FirstnameEnrichmentService } from './firstname-enrichment.service';
import { EnrichRequestDto } from './dto/enrich-request.dto';
import { EnrichmentResponseDto } from './dto/enrichment-response.dto';

@Controller('api/v1/firstname-enrichment')
export class FirstnameEnrichmentController {
  constructor(
    private readonly enrichmentService: FirstnameEnrichmentService,
  ) {}

  @Post('enrich')
  async enrich(@Body() body: EnrichRequestDto): Promise<EnrichmentResponseDto> {
    return this. enrichmentService.enrich(body.email);
  }

  @Post('import/batch')
  async importBatch(@Body() body: { firstnames: any[] }) {
    return this.enrichmentService.importBatch(body. firstnames);
  }

  @Get('stats')
  async getStats() {
    return this.enrichmentService.getStats();
  }

  @Get('top')
  async getTop(@Query('limit') limit?: number) {
    return this.enrichmentService.getTop(limit || 100);
  }
}