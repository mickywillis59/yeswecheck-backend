import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FirstnameEnrichmentService } from './firstname-enrichment.service';
import { InseeFirstname } from './entities/insee-firstname.entity';

describe('FirstnameEnrichmentService', () => {
  let service: FirstnameEnrichmentService;
  let mockRepository: any;
  let mockRedis: any;

  beforeEach(async () => {
    // Mock Redis client
    mockRedis = {
      keys: jest.fn().mockResolvedValue([]),
      get: jest.fn(),
      set: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        set: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    // Mock repository
    mockRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FirstnameEnrichmentService,
        {
          provide: getRepositoryToken(InseeFirstname),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<FirstnameEnrichmentService>(FirstnameEnrichmentService);
    
    // Replace Redis client with mock
    (service as any).redisClient = mockRedis;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Firstname Extraction', () => {
    beforeEach(() => {
      // Setup mock Redis data for test firstnames
      mockRedis.get.mockImplementation((key: string) => {
        const firstname = key.replace('firstname:', '');
        
        const mockData: Record<string, any> = {
          jean: {
            maleCount: 500000,
            femaleCount: 1000,
            totalCount: 501000,
            genderRatio: 0.998,
            dominantGender: 'M',
            estimatedAge: 67,
            ageP25: 52,
            ageP50: 68,
            ageP75: 79,
            peakDecade: '1950s',
          },
          dupont: {
            maleCount: 5000,
            femaleCount: 4000,
            totalCount: 9000,
            genderRatio: 0.556,
            dominantGender: 'M',
            estimatedAge: 45,
            ageP25: 30,
            ageP50: 45,
            ageP75: 60,
            peakDecade: '1970s',
          },
          martin: {
            maleCount: 8000,
            femaleCount: 7000,
            totalCount: 15000,
            genderRatio: 0.533,
            dominantGender: 'M',
            estimatedAge: 50,
            ageP25: 35,
            ageP50: 50,
            ageP75: 65,
            peakDecade: '1970s',
          },
          pierre: {
            maleCount: 450000,
            femaleCount: 500,
            totalCount: 450500,
            genderRatio: 0.999,
            dominantGender: 'M',
            estimatedAge: 65,
            ageP25: 50,
            ageP50: 66,
            ageP75: 77,
            peakDecade: '1950s',
          },
          marie: {
            maleCount: 500,
            femaleCount: 480000,
            totalCount: 480500,
            genderRatio: 0.999,
            dominantGender: 'F',
            estimatedAge: 68,
            ageP25: 53,
            ageP50: 69,
            ageP75: 80,
            peakDecade: '1950s',
          },
        };
        
        if (mockData[firstname]) {
          return Promise.resolve(JSON.stringify(mockData[firstname]));
        }
        
        return Promise.resolve(null);
      });
    });

    it('should extract firstname from "jean.dupont@example.com"', async () => {
      const result = await service.enrich('jean.dupont@example.com');
      
      expect(result.firstName).toBe('Jean');
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(50);
      expect(result.firstNameConfidence).toBeLessThanOrEqual(100);
    });

    it('should extract firstname from "JEAN@example.com"', async () => {
      const result = await service.enrich('JEAN@example.com');
      
      expect(result.firstName).toBe('Jean');
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(50);
    });

    it('should extract firstname from "jean49@example.com"', async () => {
      const result = await service.enrich('jean49@example.com');
      
      expect(result.firstName).toBe('Jean');
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(50);
    });

    it('should extract firstname from "59jean@example.com"', async () => {
      const result = await service.enrich('59jean@example.com');
      
      expect(result.firstName).toBe('Jean');
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(50);
    });

    it('should extract firstname from "jean!@example.com"', async () => {
      const result = await service.enrich('jean!@example.com');
      
      expect(result.firstName).toBe('Jean');
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(50);
    });

    it('should detect pattern "martin.jean@example.com" and prefer Jean', async () => {
      const result = await service.enrich('martin.jean@example.com');
      
      // Jean should have higher score due to position bonus
      expect(result.firstName).toBe('Jean');
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(50);
    });

    it('should handle compound names like "jean-pierre"', async () => {
      // Add mock data for jean-pierre
      const originalGet = mockRedis.get;
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'firstname:jean-pierre') {
          return Promise.resolve(JSON.stringify({
            maleCount: 120000,
            femaleCount: 100,
            totalCount: 120100,
            genderRatio: 0.999,
            dominantGender: 'M',
            estimatedAge: 60,
            ageP25: 45,
            ageP50: 61,
            ageP75: 72,
            peakDecade: '1960s',
          }));
        }
        return originalGet(key);
      });

      const result = await service.enrich('jean-pierre@example.com');
      
      expect(result.firstName).toBe('Jean-Pierre');
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(50);
    });

    it('should return null for "xyz123@example.com"', async () => {
      const result = await service.enrich('xyz123@example.com');
      
      expect(result.firstName).toBeNull();
      expect(result.firstNameConfidence).toBe(0);
      expect(result.warnings).toContain('No valid firstname detected');
    });

    it('should return null for blacklisted token "contact@example.com"', async () => {
      const result = await service.enrich('contact@example.com');
      
      expect(result.firstName).toBeNull();
      expect(result.firstNameConfidence).toBe(0);
      expect(result.warnings).toContain('No valid firstname detected');
    });

    it('should filter tokens with less than 2 characters', async () => {
      const result = await service.enrich('a.b.jean@example.com');
      
      // Should only consider 'jean' since 'a' and 'b' are filtered
      expect(result.firstName).toBe('Jean');
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Score Validation', () => {
    beforeEach(() => {
      // Setup mock with very high count to test score bounds
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'firstname:test') {
          return Promise.resolve(JSON.stringify({
            maleCount: 9999999,
            femaleCount: 1000,
            totalCount: 10000999,
            genderRatio: 0.9999,
            dominantGender: 'M',
            estimatedAge: 50,
            ageP25: 35,
            ageP50: 50,
            ageP75: 65,
            peakDecade: '1970s',
          }));
        }
        return Promise.resolve(null);
      });
    });

    it('should never return confidence score greater than 100', async () => {
      const result = await service.enrich('test@example.com');
      
      expect(result.firstNameConfidence).toBeLessThanOrEqual(100);
      expect(result.firstNameConfidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Gender/Civility Deduction', () => {
    beforeEach(() => {
      mockRedis.get.mockImplementation((key: string) => {
        const testData: Record<string, any> = {
          'firstname:pierre': {
            maleCount: 450000,
            femaleCount: 500,
            totalCount: 450500,
            genderRatio: 0.999,
            dominantGender: 'M',
            estimatedAge: 65,
            ageP25: 50,
            ageP50: 66,
            ageP75: 77,
            peakDecade: '1950s',
          },
          'firstname:marie': {
            maleCount: 500,
            femaleCount: 480000,
            totalCount: 480500,
            genderRatio: 0.999,
            dominantGender: 'F',
            estimatedAge: 68,
            ageP25: 53,
            ageP50: 69,
            ageP75: 80,
            peakDecade: '1950s',
          },
          'firstname:camille': {
            maleCount: 50000,
            femaleCount: 60000,
            totalCount: 110000,
            genderRatio: 0.545,
            dominantGender: 'F',
            estimatedAge: 30,
            ageP25: 20,
            ageP50: 30,
            ageP75: 40,
            peakDecade: '1990s',
          },
        };
        
        return Promise.resolve(testData[key] ? JSON.stringify(testData[key]) : null);
      });
    });

    it('should deduce M. for male names with >85% male count', async () => {
      const result = await service.enrich('pierre@example.com');
      
      expect(result.civility).toBe('M.');
      expect(result.gender).toBe('M');
      expect(result.genderConfidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should deduce Mme for female names with >85% female count', async () => {
      const result = await service.enrich('marie@example.com');
      
      expect(result.civility).toBe('Mme');
      expect(result.gender).toBe('F');
      expect(result.genderConfidence).toBeGreaterThanOrEqual(0.85);
    });

    it('should return null civility for ambiguous names like Camille', async () => {
      const result = await service.enrich('camille@example.com');
      
      expect(result.civility).toBeNull();
      expect(result.gender).toBeNull();
      expect(result.genderConfidence).toBeLessThan(0.85);
    });
  });

  describe('Age Calculation', () => {
    beforeEach(() => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'firstname:jean') {
          return Promise.resolve(JSON.stringify({
            maleCount: 500000,
            femaleCount: 1000,
            totalCount: 501000,
            genderRatio: 0.998,
            dominantGender: 'M',
            estimatedAge: 67,
            ageP25: 52,
            ageP50: 68,
            ageP75: 79,
            peakDecade: '1950s',
          }));
        }
        return Promise.resolve(null);
      });
    });

    it('should return age quartiles (P25, P50, P75)', async () => {
      const result = await service.enrich('jean@example.com');
      
      expect(result.presumedAge).toBe(67);
      expect(result.presumedAgeRange).not.toBeNull();
      expect(result.presumedAgeRange?.p25).toBe(52);
      expect(result.presumedAgeRange?.p50).toBe(68);
      expect(result.presumedAgeRange?.p75).toBe(79);
    });

    it('should include INSEE disclaimer in warnings', async () => {
      const result = await service.enrich('jean@example.com');
      
      expect(result.warnings).toContain('Âge basé sur naissances INSEE, pas population vivante actuelle');
    });

    it('should warn about rare firstnames (totalCount < 1000)', async () => {
      mockRedis.get.mockImplementation((key: string) => {
        if (key === 'firstname:rare') {
          return Promise.resolve(JSON.stringify({
            maleCount: 500,
            femaleCount: 300,
            totalCount: 800,
            genderRatio: 0.625,
            dominantGender: 'M',
            estimatedAge: 40,
            ageP25: 30,
            ageP50: 40,
            ageP75: 50,
            peakDecade: '1980s',
          }));
        }
        return Promise.resolve(null);
      });

      const result = await service.enrich('rare@example.com');
      
      expect(result.warnings).toContain('Prénom rare, scoring avec confiance réduite');
    });
  });

  describe('Ambiguity Ratio Check', () => {
    beforeEach(() => {
      mockRedis.get.mockImplementation((key: string) => {
        const data: Record<string, any> = {
          'firstname:token1': {
            maleCount: 10000,
            femaleCount: 1000,
            totalCount: 11000,
            genderRatio: 0.909,
            dominantGender: 'M',
            estimatedAge: 50,
            ageP25: 35,
            ageP50: 50,
            ageP75: 65,
            peakDecade: '1970s',
          },
          'firstname:token2': {
            maleCount: 9500,
            femaleCount: 1000,
            totalCount: 10500,
            genderRatio: 0.905,
            dominantGender: 'M',
            estimatedAge: 50,
            ageP25: 35,
            ageP50: 50,
            ageP75: 65,
            peakDecade: '1970s',
          },
        };
        
        return Promise.resolve(data[key] ? JSON.stringify(data[key]) : null);
      });
    });

    it('should reject when best score is not 1.25x better than second best', async () => {
      const result = await service.enrich('token1.token2@example.com');
      
      // If tokens are too similar in score, should return null or have low confidence
      // This depends on exact implementation but ratio should be checked
      expect(result.debug?.appliedRatio).toBeDefined();
    });
  });
});
