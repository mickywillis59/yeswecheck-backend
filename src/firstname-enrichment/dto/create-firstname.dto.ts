import { IsString, IsInt, IsNumber, IsArray, IsOptional } from 'class-validator';

export class CreateFirstnameDto {
  @IsString()
  firstname: string;

  @IsInt()
  maleCount: number;

  @IsInt()
  femaleCount: number;

  @IsInt()
  totalCount: number;

  @IsNumber()
  genderRatio: number;

  @IsString()
  @IsOptional()
  dominantGender:  string | null;

  @IsArray()
  birthYears: {
    year: number;
    maleCount: number;
    femaleCount: number;
    totalCount: number;
  }[];

  @IsInt()
  @IsOptional()
  estimatedAge: number | null;

  @IsInt()
  @IsOptional()
  ageP25: number | null;

  @IsInt()
  @IsOptional()
  ageP50: number | null;

  @IsInt()
  @IsOptional()
  ageP75: number | null;

  @IsString()
  @IsOptional()
  peakDecade: string | null;
}