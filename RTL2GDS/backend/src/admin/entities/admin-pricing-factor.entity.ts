import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('admin_pricing_factors')
export class AdminPricingFactor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'varchar', length: 50, unique: true, name: 'factor_key' })
  factorKey: string;

  @Column({ type: 'varchar', length: 100 })
  label: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  scope: 'block' | 'full_chip' | 'dft';

  @Column({ type: 'varchar', length: 30, name: 'factor_type' })
  factorType: 'fixed_resource' | 'percentage' | 'level' | 'auto';

  @Column({ type: 'numeric', nullable: true, name: 'base_value' })
  baseValue: number;

  @Column({ type: 'jsonb', nullable: true })
  meta: any;

  @Column({ type: 'boolean', default: true, name: 'is_enabled' })
  isEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

