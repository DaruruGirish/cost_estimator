import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectBlock } from './entities/project-block.entity';
import { ProjectSelectedFactor } from './entities/project-selected-factor.entity';
import { ProjectDftCadFlow } from './entities/project-dft-cad-flow.entity';
import { ProjectCostBreakdown } from './entities/project-cost-breakdown.entity';
import { ProjectConfiguration } from '../types';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private projectRepository: Repository<Project>,
    @InjectRepository(ProjectBlock)
    private projectBlockRepository: Repository<ProjectBlock>,
    @InjectRepository(ProjectSelectedFactor)
    private projectSelectedFactorRepository: Repository<ProjectSelectedFactor>,
    @InjectRepository(ProjectDftCadFlow)
    private projectDftCadFlowRepository: Repository<ProjectDftCadFlow>,
    @InjectRepository(ProjectCostBreakdown)
    private projectCostBreakdownRepository: Repository<ProjectCostBreakdown>,
  ) {}

  async createProject(
    projectConfig: ProjectConfiguration,
    calculatedCost: number,
    calculatedDuration: number,
    breakdown: any,
    userId: number | null,
  ): Promise<Project> {
    // Create main project record
    const project = this.projectRepository.create({
      userId: userId,
      projectName: projectConfig.projectName || 'Untitled Project',
      customerName: projectConfig.customerName || null,
      customerEmail: projectConfig.emailId || null,
      technologyNode: projectConfig.technology || null,
      isFullChip: projectConfig.fullChip?.enabled || false,
      numberOfBlocks: projectConfig.blocks?.length || 0,
      estimatedCost: calculatedCost,
      estimatedDurationMonths: calculatedDuration,
    });

    const savedProject = await this.projectRepository.save(project);

    // Create project blocks
    const savedBlocks: ProjectBlock[] = [];
    if (projectConfig.blocks && projectConfig.blocks.length > 0) {
      for (const block of projectConfig.blocks) {
        const savedBlock = await this.projectBlockRepository.save(
          this.projectBlockRepository.create({
            projectId: savedProject.id,
            blockName: block.blockName || 'Unnamed Block',
            gateCountMillion: block.gateCount || 0,
            rtlDrops: block.rtl_drop_count || null,
            lowPowerType: this.extractLowPowerType(block), // Extract from additionalFactors or complexityFactorLevels
          })
        );
        savedBlocks.push(savedBlock);

        // Save block-level selected factors
        await this.saveBlockFactors(savedProject.id, savedBlock.id, block);
      }
    }

    // Save full chip factors if enabled
    if (projectConfig.fullChip?.enabled) {
      await this.saveFullChipFactors(savedProject.id, projectConfig.fullChip);
    }

    // Save DFT CAD/Flow if enabled
    if (projectConfig.fullChip?.cadFlow && breakdown?.dftCadFlowResources) {
      await this.projectDftCadFlowRepository.save(
        this.projectDftCadFlowRepository.create({
          projectId: savedProject.id,
          resources: breakdown.dftCadFlowResources,
        })
      );
    }

    // Save cost breakdown if available
    if (breakdown?.components) {
      const breakdownEntries = Object.entries(breakdown.components).map(([component, data]: [string, any]) =>
        this.projectCostBreakdownRepository.create({
          projectId: savedProject.id,
          component: component,
          resources: data.resources || null,
          cost: data.cost || null,
        })
      );
      await this.projectCostBreakdownRepository.save(breakdownEntries);
    }

    // Reload project with relations
    return this.findById(savedProject.id);
  }

  private extractLowPowerType(block: any): 'none' | 'non_nested' | 'nested' {
    // Extract low power type from complexityFactorLevels or additionalFactors
    // This is a simplified version - adjust based on actual data structure
    if (block.complexityFactorLevels?.lowPower === 'nested') {
      return 'nested';
    }
    if (block.complexityFactorLevels?.lowPower === 'non_nested') {
      return 'non_nested';
    }
    if (block.additionalFactors?.lowPower === 'nested') {
      return 'nested';
    }
    if (block.additionalFactors?.lowPower === 'non_nested') {
      return 'non_nested';
    }
    return 'none';
  }

  private async saveBlockFactors(projectId: number, blockId: number, block: any) {
    const factors: ProjectSelectedFactor[] = [];

    // Save complexity factors (simple checkbox factors)
    if (block.complexityFactors && Array.isArray(block.complexityFactors)) {
      for (const factorKey of block.complexityFactors) {
        factors.push(
          this.projectSelectedFactorRepository.create({
            projectId,
            blockId,
            factorKey,
            appliedValue: 1, // Simple checkbox = 1
            factorSnapshot: null, // TODO: Get snapshot from admin_pricing_factors at creation time
          })
        );
      }
    }

    // Save complexity factor levels (factors with levels)
    if (block.complexityFactorLevels) {
      for (const [factorKey, levelId] of Object.entries(block.complexityFactorLevels)) {
        factors.push(
          this.projectSelectedFactorRepository.create({
            projectId,
            blockId,
            factorKey,
            appliedValue: 1, // Use 1 as placeholder since levelId is stored in snapshot
            factorSnapshot: {
              levelId: levelId, // Store the actual level ID in JSONB snapshot
            },
          })
        );
      }
    }

    // Save additional factors
    if (block.additionalFactors) {
      for (const [factorKey, value] of Object.entries(block.additionalFactors)) {
        factors.push(
          this.projectSelectedFactorRepository.create({
            projectId,
            blockId,
            factorKey,
            appliedValue: value as any,
            factorSnapshot: null, // TODO: Get snapshot from admin_pricing_factors at creation time
          })
        );
      }
    }

    if (factors.length > 0) {
      await this.projectSelectedFactorRepository.save(factors);
    }
  }

  private async saveFullChipFactors(projectId: number, fullChip: any) {
    const factors: ProjectSelectedFactor[] = [];

    // Save fixed factors
    if (fullChip.factors && Array.isArray(fullChip.factors)) {
      for (const factorKey of fullChip.factors) {
        factors.push(
          this.projectSelectedFactorRepository.create({
            projectId,
            blockId: null, // Project-level factor
            factorKey,
            appliedValue: 1,
            factorSnapshot: null, // TODO: Get snapshot from admin_pricing_factors at creation time
          })
        );
      }
    }

    // Save percentage factors (simple checkboxes)
    if (fullChip.percentageFactors && Array.isArray(fullChip.percentageFactors)) {
      for (const factorKey of fullChip.percentageFactors) {
        factors.push(
          this.projectSelectedFactorRepository.create({
            projectId,
            blockId: null,
            factorKey,
            appliedValue: 1,
            factorSnapshot: null, // TODO: Get snapshot from admin_pricing_factors at creation time
          })
        );
      }
    }

    // Save percentage factor levels
    // CRITICAL: levelId is a string (e.g., "complex", "9-18"), but appliedValue is numeric
    // Store levelId in factorSnapshot JSONB field instead
    if (fullChip.percentageFactorLevels) {
      for (const [factorKey, levelId] of Object.entries(fullChip.percentageFactorLevels)) {
        factors.push(
          this.projectSelectedFactorRepository.create({
            projectId,
            blockId: null,
            factorKey,
            appliedValue: 1, // Use 1 as placeholder since levelId is stored in snapshot
            factorSnapshot: {
              levelId: levelId, // Store the actual level ID in JSONB snapshot
            },
          })
        );
      }
    }

    // Save DFT if enabled
    if (fullChip.dft) {
      factors.push(
        this.projectSelectedFactorRepository.create({
          projectId,
          blockId: null,
          factorKey: 'dft_enabled',
          appliedValue: 1,
          factorSnapshot: null,
        })
      );
    }

    if (factors.length > 0) {
      await this.projectSelectedFactorRepository.save(factors);
    }
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepository.find({
      relations: ['user', 'blocks'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByUserId(userId: number): Promise<Project[]> {
    return this.projectRepository.find({
      where: { userId },
      relations: ['user', 'blocks'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByEmail(email: string): Promise<Project[]> {
    const emailLower = email.toLowerCase().trim();
    return this.projectRepository.find({
      where: [
        { customerEmail: emailLower },
      ],
      relations: ['user', 'blocks'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<any> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: ['user', 'blocks'],
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    // Load all selected factors for this project
    const selectedFactors = await this.projectSelectedFactorRepository.find({
      where: { projectId: id },
      relations: ['block'],
    });

    // Organize factors by block and project level
    const blockFactors: Record<number, any[]> = {};
    const projectFactors: any[] = [];

    for (const factor of selectedFactors) {
      if (factor.blockId) {
        if (!blockFactors[factor.blockId]) {
          blockFactors[factor.blockId] = [];
        }
        blockFactors[factor.blockId].push({
          factorKey: factor.factorKey,
          appliedValue: factor.appliedValue,
          factorSnapshot: factor.factorSnapshot,
        });
      } else {
        projectFactors.push({
          factorKey: factor.factorKey,
          appliedValue: factor.appliedValue,
          factorSnapshot: factor.factorSnapshot,
        });
      }
    }

    // Attach factors to blocks
    const blocksWithFactors = project.blocks.map(block => ({
      ...block,
      selectedFactors: blockFactors[block.id] || [],
    }));

    return {
      ...project,
      blocks: blocksWithFactors,
      selectedFactors: projectFactors,
    };
  }

  async delete(id: number): Promise<void> {
    const result = await this.projectRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
  }

  async checkProjectNameExists(projectName: string): Promise<boolean> {
    if (!projectName || projectName.trim() === '') {
      return false;
    }
    
    // Use query builder to check for duplicate project name (case-insensitive, trimmed)
    const count = await this.projectRepository
      .createQueryBuilder('project')
      .where('LOWER(TRIM(project.project_name)) = LOWER(TRIM(:name))', { name: projectName.trim() })
      .getCount();

    return count > 0;
  }
}
