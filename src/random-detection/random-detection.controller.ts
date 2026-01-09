import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { RandomDetectionService, RandomAnalysis } from './random-detection.service';

@Controller('api/v1/random-detection')
export class RandomDetectionController {
  constructor(private readonly randomDetectionService: RandomDetectionService) {}

  @Post('check')
  async checkEmail(@Body('email') email: string): Promise<RandomAnalysis> {
    if (!email || typeof email !== 'string') {
      throw new HttpException(
        { message:  'Email is required and must be a string' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.randomDetectionService.checkEmail(email);
  }
}