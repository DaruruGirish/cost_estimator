import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { UserRole } from '../../types';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ type: 'text', name: 'password_hash', nullable: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 20, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

