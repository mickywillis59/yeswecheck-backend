import { Module } from '@nestjs/common';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';
import { DisposableEmailModule } from '../disposable-email/disposable-email.module';
import { RoleAccountModule } from '../role-account/role-account.module';
import { WhitelistModule } from '../whitelist/whitelist.module';
import { BlacklistModule } from '../blacklist/blacklist.module';
import { ProfanityModule } from '../profanity/profanity.module';  

@Module({
  imports:  [
    DisposableEmailModule,
    RoleAccountModule,
    WhitelistModule,
    BlacklistModule,
    ProfanityModule,  // ⭐ NOUVEAU
  ],
  controllers: [ValidationController],
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}