import { Module } from '@nestjs/common';
import { ValidationService } from './validation.service';
import { ValidationController } from './validation.controller';
import { DisposableEmailModule } from '../disposable-email/disposable-email.module';
import { RoleAccountModule } from '../role-account/role-account.module';
import { WhitelistModule } from '../whitelist/whitelist.module';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { ProfanityModule } from '../profanity/profanity.module';
import { RandomDetectionModule } from '../random-detection/random-detection.module';
import { FirstnameEnrichmentModule } from '../firstname-enrichment/firstname-enrichment.module';

@Module({
  imports: [
    DisposableEmailModule,
    RoleAccountModule,
    WhitelistModule,
    BlacklistModule,
    ProfanityModule,
    RandomDetectionModule,
    FirstnameEnrichmentModule,
  ],
  controllers: [ValidationController],
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}
