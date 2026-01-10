import { Test, TestingModule } from '@nestjs/testing';
import { RandomDetectionController } from './random-detection.controller';

describe('RandomDetectionController', () => {
  let controller: RandomDetectionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RandomDetectionController],
    }).compile();

    controller = module.get<RandomDetectionController>(
      RandomDetectionController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
