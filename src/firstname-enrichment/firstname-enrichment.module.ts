import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InseeFirstname } from './entities/insee-firstname.entity';
import { FirstnameEnrichmentService } from './firstname-enrichment.service';
import { FirstnameEnrichmentController } from './firstname-enrichment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([InseeFirstname])],
  controllers: [FirstnameEnrichmentController],
  providers: [FirstnameEnrichmentService],
  exports: [FirstnameEnrichmentService],
})
export class FirstnameEnrichmentModule {}
