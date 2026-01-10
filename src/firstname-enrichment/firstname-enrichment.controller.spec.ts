import { Test, TestingModule } from '@nestjs/testing';
import { FirstnameEnrichmentController } from './firstname-enrichment.controller';
import { FirstnameEnrichmentService } from './firstname-enrichment.service';

describe('FirstnameEnrichmentController', () => {
  let controller: FirstnameEnrichmentController;
  let service: FirstnameEnrichmentService;

  beforeEach(async () => {
    const mockService = {
      enrich: jest.fn(),
      count: jest.fn(),
      findAll: jest.fn(),
      importBatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FirstnameEnrichmentController],
      providers: [
        {
          provide: FirstnameEnrichmentService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<FirstnameEnrichmentController>(
      FirstnameEnrichmentController,
    );
    service = module.get<FirstnameEnrichmentService>(
      FirstnameEnrichmentService,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('enrich', () => {
    it('should call service.enrich with email', async () => {
      const mockResult = {
        firstName: 'Jean',
        firstNameConfidence: 92,
        civility: 'M.',
        gender: 'M',
        genderConfidence: 0.99,
        presumedAge: 67,
        presumedAgeRange: { p25: 52, p50: 68, p75: 79 },
        presumedAgeConfidence: 0.9,
        peakDecade: '1950s',
        detectedFrom: 'email_local_part',
        normalizedInput: 'jean',
        warnings: [
          'Âge basé sur naissances INSEE, pas population vivante actuelle',
        ],
      };

      jest.spyOn(service, 'enrich').mockResolvedValue(mockResult);

      const result = await controller.enrich({ email: 'jean@example.com' });

      expect(service.enrich).toHaveBeenCalledWith('jean@example.com');
      expect(result).toEqual(mockResult);
    });
  });

  describe('stats', () => {
    it('should return statistics', async () => {
      jest.spyOn(service, 'count').mockResolvedValue(30000);

      const result = await controller.stats();

      expect(service.count).toHaveBeenCalled();
      expect(result).toHaveProperty('totalFirstnames', 30000);
      expect(result).toHaveProperty('source', 'insee');
      expect(result).toHaveProperty('lastUpdate');
    });
  });

  describe('top', () => {
    it('should return top firstnames', async () => {
      const mockFirstnames = [
        { firstname: 'jean', totalCount: 500000 },
        { firstname: 'marie', totalCount: 480000 },
      ];

      jest.spyOn(service, 'findAll').mockResolvedValue(mockFirstnames as any);

      const result = await controller.top();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual(mockFirstnames);
    });
  });

  describe('importBatch', () => {
    it('should import batch of firstnames', async () => {
      const mockBatch = [
        {
          firstname: 'test',
          maleCount: 1000,
          femaleCount: 500,
          totalCount: 1500,
          genderRatio: 0.667,
          dominantGender: 'M',
          birthYears: [],
          estimatedAge: 40,
          ageP25: 30,
          ageP50: 40,
          ageP75: 50,
          peakDecade: '1980s',
        },
      ];

      const mockResult = { imported: 1, skipped: 0 };
      jest.spyOn(service, 'importBatch').mockResolvedValue(mockResult);

      const result = await controller.importBatch({ firstnames: mockBatch });

      expect(service.importBatch).toHaveBeenCalledWith(mockBatch);
      expect(result).toEqual(mockResult);
    });
  });
});
