import { Test, TestingModule } from '@nestjs/testing';
import { RandomDetectionService } from './random-detection.service';

describe('RandomDetectionService', () => {
  let service: RandomDetectionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RandomDetectionService],
    }).compile();

    service = module.get<RandomDetectionService>(RandomDetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
