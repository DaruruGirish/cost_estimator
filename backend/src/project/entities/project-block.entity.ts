import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity';

@Entity('project_blocks')
export class ProjectBlock {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, project => project.blocks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'block_name' })
  blockName: string;

  @Column({ type: 'numeric', nullable: true, name: 'gate_count_million' })
  gateCountMillion: number;

  @Column({ type: 'integer', nullable: true, name: 'rtl_drops' })
  rtlDrops: number;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    nullable: true, 
    name: 'low_power_type' 
  })
  lowPowerType: 'none' | 'non_nested' | 'nested';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

