import { IsEmail, IsString, MinLength, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../types';

export class RegisterDto {
  @ApiProperty({
    description: 'User name',
    example: 'John Doe',
    type: String
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
    type: String
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User password (minimum 6 characters)',
    example: 'password123',
    type: String,
    minLength: 6
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'User role',
    example: 'customer',
    enum: UserRole,
    type: String
  })
  @IsEnum(UserRole)
  role: UserRole;
}

