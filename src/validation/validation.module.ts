import { Module } from '@nestjs/common';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';
import { DisposableEmailModule } from '../disposable-email/disposable-email.module';
import { RoleAccountModule } from '../role-account/role-account.module';
import { WhitelistModule } from '../whitelist/whitelist.module';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { ProfanityModule } from '../profanity/profanity.module';
import { RandomDetectionModule } from '../random-detection/random-detection.module';
import { FirstnameEnrichmentModule } from '../firstname-enrichment/firstname-enrichment.module';
import { SmtpVerificationModule } from '../smtp-verification/smtp-verification.module'; // ✅ AJOUT

@Module({
  imports: [
    DisposableEmailModule,
    RoleAccountModule,
    WhitelistModule,
    BlacklistModule,
    ProfanityModule,
    RandomDetectionModule,
    FirstnameEnrichmentModule,
    SmtpVerificationModule, // ✅ AJOUT
  ],
  controllers: [ValidationController],
  providers: [ValidationService],
})
export class ValidationModule {}
