import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateRolePatternDto {
  @IsString()
  @IsNotEmpty()
  pattern: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isCustom?: boolean;
}
