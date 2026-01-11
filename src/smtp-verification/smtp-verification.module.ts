import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmtpVerificationService } from './smtp-verification.service';
import smtpConfig from './smtp-verification.config';

@Module({
  imports: [ConfigModule.forFeature(smtpConfig)],
  providers: [SmtpVerificationService],
  exports: [SmtpVerificationService],
})
export class SmtpVerificationModule {}
