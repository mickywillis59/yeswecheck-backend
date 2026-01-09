import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean } from 'class-validator';

export class CreateProfanityDto {
  @IsString()
  @IsNotEmpty()
  word: string;

  @IsString()
  @IsOptional()
  language?: string = 'en';

  @IsEnum(['low', 'medium', 'high'])
  @IsOptional()
  severity?: 'low' | 'medium' | 'high' = 'medium';

  @IsString()
  @IsOptional()
  category?: string;

  @IsBoolean()
  @IsOptional()
  isCustom?: boolean = true;
}