export class EnrichmentResponseDto {
  firstName: string | null;
  firstNameConfidence: number;
  civility: string | null;
  gender: 'M' | 'F' | null;
  genderConfidence:  number | null;
  presumedAge: number | null;
  presumedAgeRange: {
    p25: number | null;
    p50: number | null;
    p75: number | null;
  } | null;
  presumedAgeConfidence: number | null;
  peakDecade: string | null;
  detectedFrom: string | null;
  normalizedInput:  string | null;
  warnings:  string[];
  debug?: any;
}