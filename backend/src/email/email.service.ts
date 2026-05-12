import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    // Support both SMTP_PASS and SMTP_PASSWORD for compatibility
    const password = this.configService.get<string>('SMTP_PASS') || this.configService.get<string>('SMTP_PASSWORD');

    // Check if SMTP is configured (make it optional)
    if (!host || !user || !password) {
      const missing = [];
      if (!host) missing.push('SMTP_HOST');
      if (!user) missing.push('SMTP_USER');
      if (!password) missing.push('SMTP_PASS or SMTP_PASSWORD');
      
      console.warn('⚠️  SMTP Configuration Warning: Missing environment variables:', missing.join(', '));
      console.warn('   Backend will start, but OTP email functionality will be disabled.');
      console.warn('   To enable email, add these to your .env file:');
      console.warn('   SMTP_HOST=your-smtp-host');
      console.warn('   SMTP_USER=your-smtp-user');
      console.warn('   SMTP_PASS=your-smtp-password');
      this.isConfigured = false;
      return; // Don't throw error, just skip SMTP setup
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: secure,
        auth: {
          user: user,
          pass: password,
        },
      });

      this.isConfigured = true;
      console.log('✓ SMTP configured successfully:', {
        host: host,
        port: port,
        secure: secure,
        user: user,
        password: password ? '***' : 'MISSING',
      });
    } catch (error) {
      console.error('❌ Failed to configure SMTP:', error);
      this.isConfigured = false;
    }
  }

  async sendOtpEmail(to: string, otpCode: string): Promise<void> {
    // Check if SMTP is configured
    if (!this.isConfigured || !this.transporter) {
      const errorMsg = 'SMTP is not configured. Please configure SMTP settings (SMTP_HOST, SMTP_USER, SMTP_PASS) in your .env file to send OTP emails.';
      console.error(`❌ ${errorMsg}`);
      console.error(`   OTP code for ${to}: ${otpCode} (NOT SENT - SMTP not configured)`);
      throw new Error(errorMsg);
    }

    // Support both SMTP_FROM and SMTP_FROM_EMAIL for compatibility
    const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_FROM_EMAIL') || this.configService.get<string>('SMTP_USER');
    
    const mailOptions = {
      from: fromEmail,
      to: to,
      subject: 'Your OTP Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Email Verification</h2>
          <p>Your OTP verification code is:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; font-size: 32px; margin: 0; letter-spacing: 5px;">${otpCode}</h1>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`✓ OTP email sent successfully to ${to}`);
    } catch (error: any) {
      console.error(`❌ Failed to send email to ${to}:`, error.message);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}