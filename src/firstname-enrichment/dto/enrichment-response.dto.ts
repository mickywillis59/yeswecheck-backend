export class EnrichmentResponseDto {
  firstName: string | null;
  firstNameConfidence: number;
  civility: string | null;
  gender: string | null;
  genderConfidence: number | null;
  presumedAge: number | null;
  presumedAgeRange: { p25: number; p50: number; p75: number } | null;
  presumedAgeConfidence: number | null;
  peakDecade: string | null;
  detectedFrom: string | null;
  normalizedInput: string | null;
  warnings: string[];
  debug?: any;
}
