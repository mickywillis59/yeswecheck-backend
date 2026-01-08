import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateDisposableDto {
  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsString()
  @IsOptional()
  provider?: string;

  @IsBoolean()
  @IsOptional()
  isCustom?: boolean;
}
