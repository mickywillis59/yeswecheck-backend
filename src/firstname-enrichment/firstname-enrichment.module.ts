import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FirstnameEnrichmentService } from './firstname-enrichment.service';
import { FirstnameEnrichmentController } from './firstname-enrichment.controller';
import { InseeFirstname } from './entities/insee-firstname.entity';
import { AmbiguousFirstname } from './entities/ambiguous-firstname.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InseeFirstname,
      AmbiguousFirstname,
    ]),
  ],
  controllers: [FirstnameEnrichmentController],
  providers: [FirstnameEnrichmentService],
  exports: [FirstnameEnrichmentService],
})
export class FirstnameEnrichmentModule {}