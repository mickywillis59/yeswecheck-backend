import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateFirstnameDto {
  @IsString()
  @IsNotEmpty()
  firstname: string;

  @IsNumber()
  maleCount: number;

  @IsNumber()
  femaleCount: number;

  @IsNumber()
  totalCount: number;

  @IsNumber()
  genderRatio: number;

  @IsString()
  @IsOptional()
  dominantGender?: string;

  @IsArray()
  birthYears: any[];

  @IsNumber()
  @IsOptional()
  estimatedAge?: number;

  @IsNumber()
  @IsOptional()
  ageP25?: number;

  @IsNumber()
  @IsOptional()
  ageP50?: number;

  @IsNumber()
  @IsOptional()
  ageP75?: number;

  @IsString()
  @IsOptional()
  peakDecade?: string;
}
