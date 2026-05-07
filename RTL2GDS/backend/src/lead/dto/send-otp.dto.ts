import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({
    description: 'Email address to send OTP',
    example: 'customer@example.com',
    type: String
  })
  @IsEmail()
  email: string;
}