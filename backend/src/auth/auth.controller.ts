import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ 
    status: 201, 
    description: 'User registered successfully. Returns JWT token, role, email, and name',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          description: 'JWT access token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        role: {
          type: 'string',
          enum: ['admin', 'customer'],
          description: 'User role',
          example: 'customer'
        },
        email: {
          type: 'string',
          description: 'User email',
          example: 'user@example.com'
        },
        name: {
          type: 'string',
          description: 'User name',
          example: 'John Doe'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 409, 
    description: 'User with this email already exists' 
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data or email domain validation failed. Only company email addresses are allowed. Personal email domains (Gmail, Yahoo, Outlook, etc.) are not accepted.'
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto.name, registerDto.email, registerDto.password, registerDto.role);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns JWT token, role, email, and name',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          description: 'JWT access token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        role: {
          type: 'string',
          enum: ['admin', 'customer'],
          description: 'User role',
          example: 'admin'
        },
        email: {
          type: 'string',
          description: 'User email',
          example: 'admin@rtlgds.com'
        },
        name: {
          type: 'string',
          description: 'User name',
          example: 'Admin User'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Invalid email or password' 
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }
}

