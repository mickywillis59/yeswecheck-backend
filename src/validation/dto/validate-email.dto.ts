import { IsEmail, IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ValidateEmailDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  smtp?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(5000)
  smtpTimeout?: number;
}
