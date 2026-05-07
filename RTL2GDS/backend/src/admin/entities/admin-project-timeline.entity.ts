import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('admin_project_timelines')
export class AdminProjectTimeline {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  scope: 'block' | 'full_chip';

  @Column({ type: 'integer', name: 'rtl_drops' })
  rtlDrops: number;

  @Column({ type: 'integer', name: 'duration_months' })
  durationMonths: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

