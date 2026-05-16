import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { Project } from './entities/project.entity';
import { ProjectBlock } from './entities/project-block.entity';
import { ProjectSelectedFactor } from './entities/project-selected-factor.entity';
import { ProjectDftCadFlow } from './entities/project-dft-cad-flow.entity';
import { ProjectCostBreakdown } from './entities/project-cost-breakdown.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectBlock,
      ProjectSelectedFactor,
      ProjectDftCadFlow,
      ProjectCostBreakdown,
      User,
    ]),
  ],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}

