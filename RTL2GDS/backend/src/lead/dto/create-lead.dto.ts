import { IsEmail, IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLeadDto {
  @ApiProperty({
    description: 'Lead name',
    example: 'John Doe',
    type: String
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'Lead email address',
    example: 'john.doe@example.com',
    type: String
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Phone number (optional)',
    example: '+1234567890',
    type: String,
    required: false
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({
    description: 'Company name',
    example: 'Acme Corp',
    type: String,
   
  })
  @IsString()
  @MinLength(2)
  company: string;
}

