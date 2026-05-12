import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { EmailService } from '../email/email.service';
import { validateEmailDomain } from '../utils/email-domain.validator';

@Injectable()
export class OtpService {
  private readonly OTP_EXPIRY_MINUTES = 10;

  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
    private emailService: EmailService,
  ) {}

  /**
   * Generate a random 6-digit OTP
   */
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send OTP to email address
   */
  async sendOtp(email: string): Promise<{ message: string }> {
    // Validate email domain
    validateEmailDomain(email);

    const normalizedEmail = email.trim().toLowerCase();
    
    // Generate OTP
    const otpCode = this.generateOtp();
    const otpExpiresAt = new Date();
    otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + this.OTP_EXPIRY_MINUTES);

    // Find or create lead record
    let lead = await this.leadRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (lead) {
      // Update existing lead with new OTP
      lead.otpCode = otpCode;
      lead.otpExpiresAt = otpExpiresAt;
      lead.emailVerified = false; // Reset verification status
    } else {
      // Create new lead record (without name, phone, company yet)
      lead = this.leadRepository.create({
        email: normalizedEmail,
        name: '', // Will be filled later
        otpCode,
        otpExpiresAt,
        emailVerified: false,
      });
    }

    // Send OTP email first - if this fails, don't save OTP
    try {
      await this.emailService.sendOtpEmail(normalizedEmail, otpCode);
    } catch (error: any) {
      // If email fails, don't save OTP to database
      throw new BadRequestException(
        error.message || 'Failed to send OTP email. Please check your email configuration or try again later.'
      );
    }

    // Only save OTP if email was sent successfully
    await this.leadRepository.save(lead);

    return {
      message: 'OTP has been sent to your email address',
    };
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(email: string, otpCode: string): Promise<{ message: string; verified: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = otpCode.trim();

    // Find lead by email
    const lead = await this.leadRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!lead) {
      throw new BadRequestException('Email not found. Please request a new OTP.');
    }

    // Check if OTP exists
    if (!lead.otpCode) {
      throw new BadRequestException('No OTP found. Please request a new OTP.');
    }

    // Check if OTP is expired
    if (!lead.otpExpiresAt || lead.otpExpiresAt < new Date()) {
      throw new BadRequestException('OTP has expired. Please request a new OTP.');
    }

    // Verify OTP code
    if (lead.otpCode !== normalizedOtp) {
      throw new BadRequestException('Invalid OTP code. Please try again.');
    }

    // Mark email as verified and clear OTP
    lead.emailVerified = true;
    lead.otpCode = null;
    lead.otpExpiresAt = null;

    await this.leadRepository.save(lead);

    return {
      message: 'Email verified successfully',
      verified: true,
    };
  }
}