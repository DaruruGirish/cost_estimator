import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity';
import { ProjectBlock } from './project-block.entity';

@Entity('project_selected_factors')
export class ProjectSelectedFactor {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: number;

  @ManyToOne(() => ProjectBlock, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'block_id' })
  block: ProjectBlock;

  @Column({ name: 'block_id', nullable: true })
  blockId: number;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'factor_key' })
  factorKey: string;

  @Column({ type: 'numeric', nullable: true, name: 'applied_value' })
  appliedValue: number;

  @Column({ type: 'jsonb', nullable: true, name: 'factor_snapshot' })
  factorSnapshot: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

