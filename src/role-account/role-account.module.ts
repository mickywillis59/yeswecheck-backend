import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePattern } from './role-pattern.entity';
import { RoleAccountService } from './role-account.service';
import { RoleAccountController } from './role-account.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RolePattern])],
  controllers: [RoleAccountController],
  providers: [RoleAccountService],
  exports: [RoleAccountService],
})
export class RoleAccountModule {}
