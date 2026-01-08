import { IsEnum, IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateWhitelistDto {
  @IsEnum(['domain', 'email'], {
    message: 'Type must be either "domain" or "email"',
  })
  @IsNotEmpty()
  type: 'domain' | 'email';

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
