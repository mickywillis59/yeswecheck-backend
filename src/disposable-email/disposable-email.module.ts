import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisposableDomain } from './disposable-domain.entity';
import { DisposableEmailService } from './disposable-email.service';
import { DisposableEmailController } from './disposable-email.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DisposableDomain])],
  controllers: [DisposableEmailController],
  providers: [DisposableEmailService],
  exports: [DisposableEmailService],
})
export class DisposableEmailModule {}
