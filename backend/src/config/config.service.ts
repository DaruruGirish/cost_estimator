import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Configuration, BlockGateCount, ProjectTimeline, BlockComplexityFactor, FullChipFactor, FullChipPercentageFactor, DFTFactor } from '../types';
import { defaultConfiguration } from './default-config';
import { AdminProjectTimeline } from '../admin/entities/admin-project-timeline.entity';
import { AdminPricingFactor } from '../admin/entities/admin-pricing-factor.entity';
import { AdminCostSetting } from '../admin/entities/admin-cost-setting.entity';

@Injectable()
export class ConfigService implements OnModuleInit {
  private configuration: Configuration = defaultConfiguration;

  constructor(
    @InjectRepository(AdminProjectTimeline)
    private timelineRepository: Repository<AdminProjectTimeline>,
    @InjectRepository(AdminPricingFactor)
    private pricingFactorRepository: Repository<AdminPricingFactor>,
    @InjectRepository(AdminCostSetting)
    private costSettingRepository: Repository<AdminCostSetting>,
  ) {}

  async onModuleInit() {
    // Load configuration from database on startup
    await this.loadConfigurationFromDatabase();
    
    // If database is empty, initialize with defaults
    const timelineCount = await this.timelineRepository.count();
    const factorCount = await this.pricingFactorRepository.count();
    const costSettingCount = await this.costSettingRepository.count();
    
    if (timelineCount === 0 && factorCount === 0 && costSettingCount === 0) {
      console.log('Database is empty, initializing with default configuration...');
      await this.saveConfigurationToDatabase(defaultConfiguration);
      this.configuration = defaultConfiguration;
    }
  }

  /**
   * Load configuration from database and convert to Configuration interface
   */
  private async loadConfigurationFromDatabase(): Promise<void> {
    try {
      // Load timelines
      const timelines = await this.timelineRepository.find();
      const blockTimeline: ProjectTimeline[] = [];
      const fullChipTimeline: ProjectTimeline[] = [];

      timelines.forEach(timeline => {
        const timelineEntry: ProjectTimeline = {
          id: `timeline-${timeline.id}`,
          name: `${timeline.rtlDrops} RTL Drop${timeline.rtlDrops > 1 ? 's' : ''}`,
          rtl_drop_count: timeline.rtlDrops as 1 | 2 | 3,
          months: timeline.durationMonths,
          notes: timeline.notes || '',
        };

        if (timeline.scope === 'block') {
          blockTimeline.push(timelineEntry);
        } else if (timeline.scope === 'full_chip') {
          fullChipTimeline.push(timelineEntry);
        }
      });

      // Sort by rtl_drop_count descending
      blockTimeline.sort((a, b) => b.rtl_drop_count - a.rtl_drop_count);
      fullChipTimeline.sort((a, b) => b.rtl_drop_count - a.rtl_drop_count);

      // Load pricing factors
      const pricingFactors = await this.pricingFactorRepository.find({
        where: { isEnabled: true },
        order: { category: 'ASC', factorKey: 'ASC' },
      });

      // Parse pricing factors into configuration structure
      const blockComplexity: BlockComplexityFactor[] = [];
      const fullChipFixed: FullChipFactor[] = [];
      const fullChipPercentage: FullChipPercentageFactor[] = [];
      let dftCadFlow: DFTFactor | null = null;
      let blockGateCount: BlockGateCount | null = null;
      const technologyNodeMultipliers: Record<string, number> = {};

      for (const factor of pricingFactors) {
        if (factor.category === 'Block Complexity' && factor.scope === 'block') {
          blockComplexity.push({
            id: factor.factorKey,
            name: factor.label,
            resourcePercentage: factor.baseValue || 0,
            notes: factor.description || '',
            enabled: factor.isEnabled,
            autoApplied: factor.factorType === 'auto',
            levels: factor.meta?.levels || undefined,
          });
        } else if (factor.category === 'Full Chip' && factor.scope === 'full_chip') {
          if (factor.factorType === 'fixed_resource') {
            fullChipFixed.push({
              id: factor.factorKey,
              name: factor.label,
              resources: factor.baseValue || 0,
              notes: factor.description || '',
            });
          } else if (factor.factorType === 'percentage' || factor.factorType === 'level' || factor.factorType === 'auto') {
            const isAutoApplied = factor.factorType === 'auto';
            fullChipPercentage.push({
              id: factor.factorKey,
              name: factor.label,
              resourcePercentage: factor.baseValue || 0,
              notes: factor.description || '',
              enabled: factor.isEnabled,
              autoApplied: isAutoApplied,
              levels: factor.meta?.levels || undefined,
            });
          }
        } else if (factor.category === 'DFT' && factor.scope === 'dft') {
          // DFT CAD/Flow has been removed - DFT effort comes only from percentage adders
          // Skip loading CAD/Flow fixed resources
        } else if (factor.category === 'Block Gate Count') {
          // Block Gate Count is stored as multiple factors or in meta
          if (factor.meta) {
            blockGateCount = {
              baseGateCount: factor.meta.baseGateCount || 1.5,
              baseResource: factor.meta.baseResource || 0.5,
              gateIncrementStep: factor.meta.gateIncrementStep || 1.0,
              additionalResourcePercentage: factor.meta.additionalResourcePercentage || 10,
              maxGateCount: factor.meta.maxGateCount || 4.5,
            };
          }
        } else if (factor.category === 'Technology Node') {
          // Technology node multipliers stored in meta
          if (factor.meta && factor.meta.multipliers) {
            Object.assign(technologyNodeMultipliers, factor.meta.multipliers);
          }
        }
      }

      // Load cost settings
      const costSettings = await this.costSettingRepository.find({
        order: { createdAt: 'DESC' },
        take: 1,
      });

      const costPerResourcePerMonth = costSettings.length > 0 
        ? Number(costSettings[0].costPerResourcePerMonth) 
        : 400000;

      // Build configuration from database
      this.configuration = {
        blockTimeline: blockTimeline.length > 0 ? blockTimeline : defaultConfiguration.blockTimeline,
        fullChipTimeline: fullChipTimeline.length > 0 ? fullChipTimeline : defaultConfiguration.fullChipTimeline,
        blockGateCount: blockGateCount || defaultConfiguration.blockGateCount,
        blockComplexity: blockComplexity.length > 0 ? blockComplexity : defaultConfiguration.blockComplexity,
        fullChip: {
          fixed: fullChipFixed.length > 0 ? fullChipFixed : defaultConfiguration.fullChip.fixed,
          percentage: fullChipPercentage.length > 0 ? fullChipPercentage : defaultConfiguration.fullChip.percentage,
        },
        dft: {
          // DFT CAD/Flow has been removed - DFT effort comes only from percentage adders
          // Keep structure for backward compatibility but resources are not used
          cadFlow: defaultConfiguration.dft.cadFlow,
        },
        dftContextPercentages: defaultConfiguration.dftContextPercentages,
        costPerResourcePerMonth,
        technologyNodeMultipliers: Object.keys(technologyNodeMultipliers).length > 0 
          ? technologyNodeMultipliers 
          : defaultConfiguration.technologyNodeMultipliers,
      };
    } catch (error) {
      console.error('Error loading configuration from database, using defaults:', error);
      // Keep default configuration if database load fails
      this.configuration = defaultConfiguration;
    }
  }

  /**
   * Normalizes configuration to ensure all required fields are present with defaults
   */
  private normalizeConfiguration(config: Configuration): Configuration {
    const existingBlockGateCount: Partial<BlockGateCount> = config.blockGateCount || {};
    const blockGateCount: BlockGateCount = {
      baseGateCount: existingBlockGateCount.baseGateCount ?? 1.5,
      baseResource: existingBlockGateCount.baseResource ?? 0.5,
      gateIncrementStep: existingBlockGateCount.gateIncrementStep ?? 1.0,
      additionalResourcePercentage: existingBlockGateCount.additionalResourcePercentage ?? 10,
      maxGateCount: existingBlockGateCount.maxGateCount ?? 4.5,
    };

    return {
      ...config,
      blockGateCount,
      blockComplexity: (config.blockComplexity || []).map(factor => ({
        ...factor,
        enabled: factor.enabled !== undefined ? factor.enabled : true,
      })),
      fullChip: {
        fixed: (config.fullChip?.fixed || []).map(factor => ({
          ...factor,
        })),
        percentage: (() => {
          // Merge database config with defaults to ensure all factors are available
          const dbFactors = config.fullChip?.percentage || [];
          const defaultFactors = defaultConfiguration.fullChip.percentage || [];
          const factorMap = new Map<string, FullChipPercentageFactor>();
          
          // First, add all default factors
          defaultFactors.forEach(factor => {
            factorMap.set(factor.id, { ...factor });
          });
          
          // Then, override with database factors (if they exist)
          dbFactors.forEach(factor => {
            factorMap.set(factor.id, { ...factor });
          });
          
          // Convert map back to array and normalize
          return Array.from(factorMap.values()).map(factor => {
            // Normalize clock_distribution (mesh/MS-CTS) - ensure correct name and default 30%
            if (factor.id === 'clock_distribution') {
              return {
                ...factor,
                name: 'Clock Distribution', // Updated name
                enabled: factor.enabled !== undefined ? factor.enabled : true,
                resourcePercentage: (factor.resourcePercentage && factor.resourcePercentage > 0) ? factor.resourcePercentage : 30, // Default to 30% if 0, null, or undefined
                levels: undefined, // Remove levels for clock_distribution
              };
            }
            return {
              ...factor,
              enabled: factor.enabled !== undefined ? factor.enabled : true,
              levels: factor.levels?.map(level => ({
                ...level,
                locked: level.locked !== undefined ? level.locked : false,
              })),
            };
          });
        })(),
      },
      dft: config.dft || {
        // DFT CAD/Flow has been removed - DFT effort comes only from percentage adders
        cadFlow: { id: 'dft-cad', name: 'DFT CAD/Flow', resources: 0, notes: 'DEPRECATED: Removed to prevent double counting. DFT effort comes only from percentage adders.' },
      },
      dftContextPercentages: config.dftContextPercentages || defaultConfiguration.dftContextPercentages,
      costPerResourcePerMonth: config.costPerResourcePerMonth || 400000,
      technologyNodeMultipliers: config.technologyNodeMultipliers || {},
    };
  }

  getConfiguration(): Configuration {
    return this.normalizeConfiguration(this.configuration);
  }

  async updateConfiguration(config: Configuration): Promise<Configuration> {
    // Merge incoming config with existing config
    const existingConfig = this.configuration;
    
    // Merge timelines, preserving notes from existing config
    const mergeTimelines = (incoming: ProjectTimeline[] | undefined, existing: ProjectTimeline[]): ProjectTimeline[] => {
      if (!incoming || incoming.length === 0) return existing;
      return incoming.map(timeline => {
        const existingTimeline = existing.find(e => e.id === timeline.id || e.rtl_drop_count === timeline.rtl_drop_count);
        return {
          ...timeline,
          notes: timeline.notes || existingTimeline?.notes || '',
        };
      });
    };

    // Merge block complexity, preserving notes from existing config
    const mergeBlockComplexity = (incoming: BlockComplexityFactor[] | undefined, existing: BlockComplexityFactor[]): BlockComplexityFactor[] => {
      if (!incoming || incoming.length === 0) return existing;
      return incoming.map(factor => {
        // If id is missing, try to find by name, otherwise use id
        let existingFactor: BlockComplexityFactor | undefined;
        if (factor.id) {
          existingFactor = existing.find(e => e.id === factor.id);
        } else if (factor.name) {
          existingFactor = existing.find(e => e.name === factor.name);
          // Use existing factor's id if incoming factor doesn't have one
          if (existingFactor && !factor.id) {
            factor.id = existingFactor.id;
          }
        }
        
        // Validate that id is present (required for database)
        if (!factor.id) {
          throw new BadRequestException(
            `Block complexity factor "${factor.name || 'Unknown'}" is missing required "id" field`
          );
        }
        
        const mergedFactor = {
          ...factor,
          notes: factor.notes || existingFactor?.notes || '',
        };
        // Merge levels if present, preserving notes
        if (factor.levels && existingFactor?.levels) {
          mergedFactor.levels = factor.levels.map(level => {
            const existingLevel = existingFactor.levels?.find(e => e.id === level.id);
            return {
              ...level,
              notes: level.notes || existingLevel?.notes,
            };
          });
        }
        return mergedFactor;
      });
    };

    // Merge full chip fixed factors, preserving notes
    const mergeFullChipFixed = (incoming: FullChipFactor[] | undefined, existing: FullChipFactor[]): FullChipFactor[] => {
      if (!incoming || incoming.length === 0) return existing;
      return incoming.map(factor => {
        // Validate that id is present (required for database)
        if (!factor.id) {
          throw new BadRequestException(
            `Full chip fixed factor "${factor.name || 'Unknown'}" is missing required "id" field. All full chip factors must include an "id" field.`
          );
        }
        
        const existingFactor = existing.find(e => e.id === factor.id);
        return {
          ...factor,
          notes: factor.notes || existingFactor?.notes || '',
        };
      });
    };

    // Merge full chip percentage factors, preserving notes
    const mergeFullChipPercentage = (incoming: FullChipPercentageFactor[] | undefined, existing: FullChipPercentageFactor[]): FullChipPercentageFactor[] => {
      if (!incoming || incoming.length === 0) return existing;
      return incoming.map(factor => {
        // Validate that id is present (required for database)
        if (!factor.id) {
          throw new BadRequestException(
            `Full chip percentage factor "${factor.name || 'Unknown'}" is missing required "id" field. All full chip factors must include an "id" field.`
          );
        }
        
        const existingFactor = existing.find(e => e.id === factor.id);
        const mergedFactor = {
          ...factor,
          notes: factor.notes || existingFactor?.notes || '',
        };
        // Merge levels if present, preserving notes
        if (factor.levels && existingFactor?.levels) {
          mergedFactor.levels = factor.levels.map(level => {
            const existingLevel = existingFactor.levels?.find(e => e.id === level.id);
            return {
              ...level,
              notes: level.notes || existingLevel?.notes,
            };
          });
        }
        return mergedFactor;
      });
    };

    // Merge DFT - CAD/Flow has been removed, keep existing structure for backward compatibility
    const mergeDFT = (incoming: { cadFlow: DFTFactor } | undefined, existing: { cadFlow: DFTFactor }): { cadFlow: DFTFactor } => {
      // DFT CAD/Flow has been removed - always use existing (deprecated) structure
      return existing;
    };
    
    const mergedConfig: Configuration = {
      blockTimeline: mergeTimelines(config.blockTimeline, existingConfig.blockTimeline),
      fullChipTimeline: mergeTimelines(config.fullChipTimeline, existingConfig.fullChipTimeline),
      blockGateCount: config.blockGateCount ? config.blockGateCount : existingConfig.blockGateCount,
      blockComplexity: mergeBlockComplexity(config.blockComplexity, existingConfig.blockComplexity),
      fullChip: (config.fullChip && 
                 Array.isArray(config.fullChip.fixed) && config.fullChip.fixed.length > 0 &&
                 Array.isArray(config.fullChip.percentage) && config.fullChip.percentage.length > 0)
        ? {
            fixed: mergeFullChipFixed(config.fullChip.fixed, existingConfig.fullChip.fixed),
            percentage: mergeFullChipPercentage(config.fullChip.percentage, existingConfig.fullChip.percentage),
          }
        : existingConfig.fullChip,
      dft: mergeDFT(config.dft, existingConfig.dft),
      dftContextPercentages: config.dftContextPercentages ?? existingConfig.dftContextPercentages ?? defaultConfiguration.dftContextPercentages,
      costPerResourcePerMonth: config.costPerResourcePerMonth ?? existingConfig.costPerResourcePerMonth,
      technologyNodeMultipliers: config.technologyNodeMultipliers && Object.keys(config.technologyNodeMultipliers).length > 0
        ? config.technologyNodeMultipliers
        : existingConfig.technologyNodeMultipliers,
    };
    
    // Normalize before storing
    const normalizedConfig = this.normalizeConfiguration(mergedConfig);
    
    // Save to database
    await this.saveConfigurationToDatabase(normalizedConfig);
    
    // Update in-memory cache
    this.configuration = normalizedConfig;
    
    return this.configuration;
  }

  /**
   * Save configuration to database
   */
  private async saveConfigurationToDatabase(config: Configuration): Promise<void> {
    try {
      // Save timelines
      await this.saveTimelines(config);
      
      // Save pricing factors
      await this.savePricingFactors(config);
      
      // Save cost settings
      await this.saveCostSettings(config);
    } catch (error) {
      console.error('[ConfigService] Error saving configuration to database:', error);
      console.error('[ConfigService] Error message:', error?.message);
      console.error('[ConfigService] Error stack:', error?.stack);
      
      // If it's already a BadRequestException, re-throw it
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Otherwise, wrap it in a BadRequestException with a descriptive message
      const errorMessage = error?.message || 'Unknown database error occurred while saving configuration';
      throw new BadRequestException(`Failed to save configuration to database: ${errorMessage}`);
    }
  }

  private async saveTimelines(config: Configuration): Promise<void> {
    // Delete existing timelines using query builder to delete all records
    await this.timelineRepository.createQueryBuilder().delete().execute();

    // Save block timelines
    const blockTimelines = config.blockTimeline.map(timeline => 
      this.timelineRepository.create({
        scope: 'block',
        rtlDrops: timeline.rtl_drop_count,
        durationMonths: timeline.months,
        notes: timeline.notes || null,
      })
    );

    // Save full chip timelines
    const fullChipTimelines = config.fullChipTimeline.map(timeline =>
      this.timelineRepository.create({
        scope: 'full_chip',
        rtlDrops: timeline.rtl_drop_count,
        durationMonths: timeline.months,
        notes: timeline.notes || null,
      })
    );

    if (blockTimelines.length > 0 || fullChipTimelines.length > 0) {
      await this.timelineRepository.save([...blockTimelines, ...fullChipTimelines]);
    }
  }

  private async savePricingFactors(config: Configuration): Promise<void> {
    // Delete existing pricing factors using query builder to delete all records
    await this.pricingFactorRepository.createQueryBuilder().delete().execute();

    const factorsToSave: AdminPricingFactor[] = [];

    // Save block complexity factors
    for (const factor of config.blockComplexity) {
      // Validate that id is present (required for database)
      if (!factor.id) {
        throw new BadRequestException(
          `Block complexity factor "${factor.name || 'Unknown'}" is missing required "id" field. All block complexity factors must include an "id" field.`
        );
      }
      
      factorsToSave.push(
        this.pricingFactorRepository.create({
          category: 'Block Complexity',
          factorKey: factor.id,
          label: factor.name,
          description: factor.notes || null,
          scope: 'block',
          factorType: factor.autoApplied ? 'auto' : 'percentage',
          baseValue: factor.resourcePercentage,
          meta: factor.levels ? { levels: factor.levels } : null,
          isEnabled: factor.enabled !== false,
        })
      );
    }

    // Save full chip fixed factors
    for (const factor of config.fullChip.fixed) {
      // Validate that id is present (required for database)
      if (!factor.id) {
        throw new BadRequestException(
          `Full chip fixed factor "${factor.name || 'Unknown'}" is missing required "id" field. All full chip factors must include an "id" field.`
        );
      }
      
      factorsToSave.push(
        this.pricingFactorRepository.create({
          category: 'Full Chip',
          factorKey: factor.id,
          label: factor.name,
          description: factor.notes || null,
          scope: 'full_chip',
          factorType: 'fixed_resource',
          baseValue: factor.resources,
          meta: null,
          isEnabled: true,
        })
      );
    }

    // Save full chip percentage factors
    for (const factor of config.fullChip.percentage) {
      // Validate that id is present (required for database)
      if (!factor.id) {
        throw new BadRequestException(
          `Full chip percentage factor "${factor.name || 'Unknown'}" is missing required "id" field. All full chip factors must include an "id" field.`
        );
      }
      
      factorsToSave.push(
        this.pricingFactorRepository.create({
          category: 'Full Chip',
          factorKey: factor.id,
          label: factor.name,
          description: factor.notes || null,
          scope: 'full_chip',
          factorType: factor.autoApplied ? 'auto' : (factor.levels ? 'level' : 'percentage'),
          baseValue: factor.resourcePercentage,
          meta: factor.levels ? { levels: factor.levels } : null,
          isEnabled: factor.enabled !== false,
        })
      );
    }

    // DFT CAD/Flow has been removed - skip saving to prevent double counting
    // DFT effort comes only from percentage adders (Block Complexity and Full-Chip Complexity)
    // Keep this commented out for reference:
    // factorsToSave.push(
    //   this.pricingFactorRepository.create({
    //     category: 'DFT',
    //     factorKey: config.dft.cadFlow.id,
    //     label: config.dft.cadFlow.name,
    //     description: config.dft.cadFlow.notes || null,
    //     scope: 'dft',
    //     factorType: 'fixed_resource',
    //     baseValue: config.dft.cadFlow.resources,
    //     meta: null,
    //     isEnabled: true,
    //   })
    // );

    // Save block gate count as a special factor
    if (!config.blockGateCount) {
      throw new BadRequestException('blockGateCount is required but was not provided in the configuration');
    }
    
    factorsToSave.push(
      this.pricingFactorRepository.create({
        category: 'Block Gate Count',
        factorKey: 'block_gate_count',
        label: 'Block Gate Count',
        description: 'Gate count scaling parameters',
        scope: 'block',
        factorType: 'auto',
        baseValue: null,
        meta: {
          baseGateCount: config.blockGateCount.baseGateCount,
          baseResource: config.blockGateCount.baseResource,
          gateIncrementStep: config.blockGateCount.gateIncrementStep,
          additionalResourcePercentage: config.blockGateCount.additionalResourcePercentage,
          maxGateCount: config.blockGateCount.maxGateCount,
        },
        isEnabled: true,
      })
    );

    // Save technology node multipliers
    if (Object.keys(config.technologyNodeMultipliers).length > 0) {
      factorsToSave.push(
        this.pricingFactorRepository.create({
          category: 'Technology Node',
          factorKey: 'technology_node_multipliers',
          label: 'Technology Node Multipliers',
          description: 'Multipliers for different technology nodes',
          scope: 'block',
          factorType: 'auto',
          baseValue: null,
          meta: {
            multipliers: config.technologyNodeMultipliers,
          },
          isEnabled: true,
        })
      );
    }

    // Deduplicate factors by factorKey to prevent duplicate key errors
    const uniqueFactors = new Map<string, AdminPricingFactor>();
    for (const factor of factorsToSave) {
      // If a factor with the same factorKey already exists, keep the first one
      if (!uniqueFactors.has(factor.factorKey)) {
        uniqueFactors.set(factor.factorKey, factor);
      } else {
        console.warn(`[ConfigService] Duplicate factor_key detected: ${factor.factorKey}. Keeping the first occurrence.`);
      }
    }

    // Convert map back to array
    const deduplicatedFactors = Array.from(uniqueFactors.values());
    
    await this.pricingFactorRepository.save(deduplicatedFactors);
  }

  private async saveCostSettings(config: Configuration): Promise<void> {
    // Only save if costPerResourcePerMonth is provided and valid
    if (config.costPerResourcePerMonth === undefined || config.costPerResourcePerMonth === null) {
      console.log('[ConfigService] costPerResourcePerMonth not provided, skipping save');
      return;
    }

    // Ensure it's a number
    const costValue = Number(config.costPerResourcePerMonth);
    if (isNaN(costValue) || costValue < 0) {
      throw new BadRequestException(`Invalid costPerResourcePerMonth value: ${config.costPerResourcePerMonth}. Must be a valid number >= 0.`);
    }

    // Delete existing cost settings using query builder to delete all records
    await this.costSettingRepository.createQueryBuilder().delete().execute();

    // Create new cost setting
    try {
      await this.costSettingRepository.save(
        this.costSettingRepository.create({
          costPerResourcePerMonth: costValue,
          currency: 'INR',
        })
      );
      console.log(`[ConfigService] Successfully saved costPerResourcePerMonth: ${costValue}`);
    } catch (error) {
      console.error('[ConfigService] Error saving cost settings:', error);
      throw new BadRequestException(`Failed to save cost settings: ${error.message}`);
    }
  }

  async resetConfiguration(): Promise<Configuration> {
    // Reset to defaults
    this.configuration = defaultConfiguration;
    
    // Save defaults to database
    await this.saveConfigurationToDatabase(defaultConfiguration);
    
    return this.configuration;
  }
}
