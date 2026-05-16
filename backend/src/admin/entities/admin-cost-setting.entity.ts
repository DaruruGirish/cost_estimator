import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('admin_cost_settings')
export class AdminCostSetting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'numeric', name: 'cost_per_resource_per_month' })
  costPerResourcePerMonth: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

