import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ValidationModule } from './validation/validation.module';
import { WhitelistModule } from './whitelist/whitelist.module';
import { BlacklistModule } from './blacklist/blacklist.module';
import { RoleAccountModule } from './role-account/role-account.module';
import { DisposableEmailModule } from './disposable-email/disposable-email.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RandomDetectionModule } from './random-detection/random-detection.module';
import { FirstnameEnrichmentModule } from './firstname-enrichment/firstname-enrichment.module';
import { SmtpVerificationModule } from './smtp-verification/smtp-verification.module'; // ✅ AJOUT

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    ValidationModule,
    WhitelistModule,
    BlacklistModule,
    RoleAccountModule,
    DisposableEmailModule,
    RandomDetectionModule,
    FirstnameEnrichmentModule,
    SmtpVerificationModule, // ✅ AJOUT
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
