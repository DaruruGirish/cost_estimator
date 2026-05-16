import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ProjectBlock } from './project-block.entity';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @Column({ type: 'varchar', length: 150, nullable: true, name: 'project_name' })
  projectName: string;

  @Column({ type: 'varchar', length: 150, nullable: true, name: 'customer_name' })
  customerName: string;

  @Column({ type: 'varchar', length: 150, nullable: true, name: 'customer_email' })
  customerEmail: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'technology_node' })
  technologyNode: string;

  @Column({ type: 'boolean', nullable: true, name: 'is_full_chip' })
  isFullChip: boolean;

  @Column({ type: 'integer', nullable: true, name: 'number_of_blocks' })
  numberOfBlocks: number;

  @Column({ type: 'numeric', nullable: true, name: 'estimated_cost' })
  estimatedCost: number;

  @Column({ type: 'numeric', precision: 10, scale: 1, nullable: true, name: 'estimated_duration_months' })
  estimatedDurationMonths: number;

  @OneToMany(() => ProjectBlock, block => block.project, { cascade: true })
  blocks: ProjectBlock[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

