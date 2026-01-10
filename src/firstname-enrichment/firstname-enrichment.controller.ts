import { Controller, Get, Post, Body } from '@nestjs/common';
import { FirstnameEnrichmentService } from './firstname-enrichment.service';
import { CreateFirstnameDto } from './dto/create-firstname.dto';

@Controller('api/v1/firstname-enrichment')
export class FirstnameEnrichmentController {
  constructor(
    private readonly firstnameEnrichmentService: FirstnameEnrichmentService,
  ) {}

  @Post('enrich')
  async enrich(@Body() body: { email: string }) {
    return this.firstnameEnrichmentService.enrich(body.email);
  }

  @Get('stats')
  async stats() {
    const totalFirstnames = await this.firstnameEnrichmentService.count();
    return {
      totalFirstnames,
      source: 'insee',
      lastUpdate: new Date().toISOString(),
    };
  }

  @Get('top')
  async top() {
    return this.firstnameEnrichmentService.findAll();
  }

  @Post('import/batch')
  async importBatch(@Body() body: { firstnames: CreateFirstnameDto[] }) {
    return this.firstnameEnrichmentService.importBatch(body.firstnames);
  }
}
