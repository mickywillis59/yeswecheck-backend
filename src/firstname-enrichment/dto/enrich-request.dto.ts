import { IsEmail, IsNotEmpty } from 'class-validator';

export class EnrichRequestDto {
  @IsNotEmpty()
  @IsEmail()
  email: string;
}