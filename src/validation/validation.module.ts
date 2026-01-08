import { Module } from '@nestjs/common';
import { ValidationController } from './validation.controller';
import { ValidationService } from './validation.service';
import { DisposableEmailModule } from '../disposable-email/disposable-email.module';
import { RoleAccountModule } from '../role-account/role-account.module';

@Module({
  imports: [
    DisposableEmailModule,
    RoleAccountModule,  // ⭐ AJOUTER CETTE LIGNE
  ],
  controllers: [ValidationController],
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}
