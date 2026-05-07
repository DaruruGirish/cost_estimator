import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Project } from './project.entity';

@Entity('project_dft_cad_flow')
export class ProjectDftCadFlow {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'project_id' })
  projectId: number;

  @Column({ type: 'numeric', nullable: true })
  resources: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

