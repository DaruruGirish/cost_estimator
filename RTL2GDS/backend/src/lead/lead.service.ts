import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from './entities/lead.entity';
import { CreateLeadDto } from './dto/create-lead.dto';
import { validateEmailDomain } from '../utils/email-domain.validator';

@Injectable()
export class LeadService {
  constructor(
    @InjectRepository(Lead)
    private leadRepository: Repository<Lead>,
  ) {}

  async create(createLeadDto: CreateLeadDto): Promise<Lead> {
    // Validate email domain (company email only)
    validateEmailDomain(createLeadDto.email);

    const normalizedEmail = createLeadDto.email.trim().toLowerCase();

    // Check if lead with this email already exists
    const existingLead = await this.findByEmail(normalizedEmail);
    
    if (existingLead) {
      // Check if email is verified
      if (!existingLead.emailVerified) {
        throw new BadRequestException('Email is not verified. Please verify your email with OTP first.');
      }

      // Update existing lead with new information
      existingLead.name = createLeadDto.name;
      existingLead.phone = createLeadDto.phone || null;
      existingLead.company = createLeadDto.company;
      return await this.leadRepository.save(existingLead);
    }

    // For new leads, check if email was verified (should have been created during OTP process)
    // If no record exists, email was never verified
    throw new BadRequestException('Email is not verified. Please verify your email with OTP first.');
  }

  async findAll(): Promise<Lead[]> {
    return await this.leadRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Lead | null> {
    return await this.leadRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<Lead | null> {
    return await this.leadRepository.findOne({ 
      where: { email: email.toLowerCase().trim() } 
    });
  }
}