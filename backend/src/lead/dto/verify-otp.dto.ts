import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Email address',
    example: 'customer@example.com',
    type: String
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '6-digit OTP code',
    example: '123456',
    type: String
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otpCode: string;
}