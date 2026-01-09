import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfanityWord } from './profanity.entity';
import { ProfanityService } from './profanity.service';
import { ProfanityController } from './profanity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProfanityWord])],
  controllers: [ProfanityController],
  providers: [ProfanityService],
  exports: [ProfanityService],
})
export class ProfanityModule {}