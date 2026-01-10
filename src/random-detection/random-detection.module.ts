import { Module } from '@nestjs/common';
import { RandomDetectionService } from './random-detection.service';
import { RandomDetectionController } from './random-detection.controller';

@Module({
  providers: [RandomDetectionService],
  controllers: [RandomDetectionController],
  exports: [RandomDetectionService],
})
export class RandomDetectionModule {}
