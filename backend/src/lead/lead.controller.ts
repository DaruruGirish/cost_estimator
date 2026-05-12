import { Controller, Post, Get, Body, Param, ParseIntPipe, Query, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LeadService } from './lead.service';
import { OtpService } from './otp.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Lead } from './entities/lead.entity';

@ApiTags('customer')
@Controller('customer')
export class LeadController {
  constructor(
    private readonly leadService: LeadService,
    private readonly otpService: OtpService,
  ) {}

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP to customer email address' })
  @ApiResponse({ 
    status: 200, 
    description: 'OTP sent successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'OTP has been sent to your email address' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid email or email domain not allowed. Only company email addresses are allowed. Personal email domains (Gmail, Yahoo, Outlook, etc.) are not accepted.' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return await this.otpService.sendOtp(sendOtpDto.email);
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP code for customer email' })
  @ApiResponse({ 
    status: 200, 
    description: 'OTP verified successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Email verified successfully' },
        verified: { type: 'boolean', example: true }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid OTP, expired OTP, or email not found' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return await this.otpService.verifyOtp(verifyOtpDto.email, verifyOtpDto.otpCode);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new customer lead (requires email verification)' })
  @ApiResponse({ status: 201, description: 'Customer lead created successfully', type: Lead })
  @ApiResponse({ status: 400, description: 'Invalid input, email domain not allowed (only company emails accepted), or email not verified' })
  async create(@Body() createLeadDto: CreateLeadDto): Promise<Lead> {
    return await this.leadService.create(createLeadDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all customer leads or find by email' })
  @ApiQuery({ name: 'email', required: false, description: 'Email address to search for' })
  @ApiResponse({ status: 200, description: 'List of customer leads or single lead', type: [Lead] })
  async findAll(@Query('email') email?: string): Promise<Lead | Lead[]> {
    if (email) {
      const lead = await this.leadService.findByEmail(email);
      if (!lead) {
        throw new NotFoundException('Customer lead not found with the provided email');
      }
      return lead;
    }
    return await this.leadService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get customer lead by ID' })
  @ApiResponse({ status: 200, description: 'Customer lead found', type: Lead })
  @ApiResponse({ status: 404, description: 'Customer lead not found' })
  async findById(@Param('id', ParseIntPipe) id: number): Promise<Lead> {
    const lead = await this.leadService.findById(id);
    if (!lead) {
      throw new NotFoundException('Customer lead not found');
    }
    return lead;
  }
}