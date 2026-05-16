import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lead } from './entities/lead.entity';
import { LeadService } from './lead.service';
import { LeadController } from './lead.controller';
import { OtpService } from './otp.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead]),
    EmailModule,
  ],
  controllers: [LeadController],
  providers: [LeadService, OtpService],
  exports: [LeadService],
})
export class LeadModule {}