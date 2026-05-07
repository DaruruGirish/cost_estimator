import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('leads')
@Index(['email'], { unique: true })
export class Lead {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  company: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // OTP fields
  @Column({ name: 'otp_code', type: 'varchar', length: 6, nullable: true })
  otpCode: string | null;

  @Column({ name: 'otp_expires_at', type: 'timestamp', nullable: true })
  otpExpiresAt: Date | null;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;
}

