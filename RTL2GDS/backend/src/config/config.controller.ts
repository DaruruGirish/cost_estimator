import { Controller, Get, Put, Post, Patch, Body, BadRequestException, UsePipes, ValidationPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { Configuration } from '../types';
import { ConfigurationDto } from './dto/configuration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../types';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth('JWT-auth')
export class ConfigController {
  constructor(private configService: ConfigService) {}

  @Get('config')
  @ApiOperation({ 
    summary: 'Get current configuration (Admin)',
    description: 'Retrieve the complete system configuration including project timelines, block settings, full chip factors, DFT options, and cost parameters. Admin only.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the current system configuration',
    type: ConfigurationDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin role required' 
  })
  async getConfiguration(): Promise<Configuration> {
    return this.configService.getConfiguration();
  }

  @Post('set')
  @ApiOperation({ 
    summary: 'Set configuration values',
    description: 'Set ALL 6 configuration sections from Admin UI:\n\n1️⃣ **Project Timeline** - blockTimeline, fullChipTimeline\n2️⃣ **Block Gate Count** - baseGateCount, baseResource, gateIncrementStep, additionalResourcePercentage, maxGateCount\n3️⃣ **Block Complexity** - All 11 complexity factors with percentages\n4️⃣ **Full Chip** - Fixed factors, percentage factors, levels\n5️⃣ **DFT** - CAD/Flow resources\n6️⃣ **Cost Settings** - costPerResourcePerMonth\n\n**Note:** You can send complete or partial configuration - other sections will be preserved. Use GET /admin/config first to see current values.'
  })
  @ApiBody({ 
    type: ConfigurationDto,
    description: 'Complete or partial configuration object. ALL parameters are optional - only provided fields will be updated, others will be preserved.',
    examples: {
      allSixSections: {
        summary: 'All 6 Sections (Complete Config)',
        description: 'Complete configuration with ALL 6 sections from Admin UI. Use GET /admin/config first to get current values, then modify as needed.',
        value: {
          // 1. Project Timeline
          blockTimeline: [
            { id: 'block-1', name: '1 RTL Drop', rtl_drop_count: 1, months: 2 },
            { id: 'block-2', name: '2 RTL Drops', rtl_drop_count: 2, months: 4 },
            { id: 'block-3', name: '3 RTL Drops', rtl_drop_count: 3, months: 6 }
          ],
          fullChipTimeline: [
            { id: 'fc-1', name: '1 RTL Drop', rtl_drop_count: 1, months: 3 },
            { id: 'fc-2', name: '2 RTL Drops', rtl_drop_count: 2, months: 5 },
            { id: 'fc-3', name: '3 RTL Drops', rtl_drop_count: 3, months: 7 }
          ],
          // 2. Block Gate Count
          blockGateCount: {
            baseGateCount: 1.5,
            baseResource: 0.5,
            gateIncrementStep: 1.0,
            additionalResourcePercentage: 10,
            maxGateCount: 4.0
          },
          // 3. Block Complexity
          blockComplexity: [
            { id: 'synthesis_complexity', name: 'Synthesis', resourcePercentage: 5, enabled: true, autoApplied: false },
            { id: 'new_design', name: 'New Design', resourcePercentage: 20, enabled: true, autoApplied: false },
            { id: 'low_power_non_nested', name: 'Low Power - Non-nested', resourcePercentage: 10, enabled: true, autoApplied: false },
            { id: 'low_power_nested', name: 'Low Power - Nested', resourcePercentage: 30, enabled: true, autoApplied: false },
            { id: 'physical_blocks', name: 'Analog IPs', resourcePercentage: 30, enabled: true, autoApplied: false },
            { id: 'macro_intensive', name: 'Macro Intensive', resourcePercentage: 10, enabled: true, autoApplied: false },
            { id: 'io_blocks', name: 'IO Blocks', resourcePercentage: 20, enabled: true, autoApplied: false },
            { id: 'merged_mode_constraints', name: 'Merged Mode Constraints', resourcePercentage: 10, enabled: true, autoApplied: false },
            { id: 'hierarchical', name: 'Hierarchical', resourcePercentage: 100, enabled: true, autoApplied: false },
            { id: 'dft_block_level', name: 'DFT - Block Level', resourcePercentage: 60, enabled: true, autoApplied: false }
          ],
          // 4. Full Chip
          fullChip: {
            fixed: [
              { id: 'pnr', name: 'PnR (Place & Route)', resources: 1.0 },
              { id: 'ir_drop', name: 'IR Drop Analysis', resources: 0.5 },
              { id: 'pv', name: 'PV (Physical Verification)', resources: 1.0 },
              { id: 'sta', name: 'STA', resources: 1.0 }
            ],
            percentage: [
              { id: 'low_power_full_chip', name: 'Low Power - Full Chip', resourcePercentage: 10, enabled: true },
              { id: 'abutment_floorplan', name: 'Abutment Floorplan', resourcePercentage: 10, enabled: true },
              { id: 'blocks_count', name: 'Blocks Scaling', resourcePercentage: 0, enabled: true, autoApplied: true, levels: [
                { id: 'none', label: '≤8 blocks', resourcePercentage: 0, locked: true },
                { id: '9-18', label: '9-18 blocks', resourcePercentage: 10, locked: true },
                { id: '18-plus', label: '>18 blocks', resourcePercentage: 20, locked: true }
              ]},
              { id: 'clock_distribution', name: 'Clock Distribution', resourcePercentage: 30, enabled: true },
              { id: 'io_pad_count', name: 'IO Pad Cell Count', resourcePercentage: 0, enabled: true, levels: [
                { id: 'low', label: 'Low (<50 pads)', resourcePercentage: 0, locked: true },
                { id: 'medium', label: 'Medium (50-150 pads)', resourcePercentage: 0, locked: true },
                { id: 'high', label: 'High (>150 pads)', resourcePercentage: 15, locked: false }
              ]},
              { id: 'dft_top_level', name: 'DFT - Top Level', resourcePercentage: 30, enabled: true }
            ]
          },
          // 5. DFT
          dft: {
            cadFlow: { id: 'dft-cad', name: 'DFT CAD/Flow', resources: 1.0 }
          },
          // 6. Cost Settings
          costPerResourcePerMonth: 400000,
          // Additional (not in main 6 sections)
          technologyNodeMultipliers: {
            '2nm': 15,
            '3nm': 13,
            '5nm': 11,
            '7nm': 10,
            '10nm': 7,
            '12nm': 7,
            '14nm': 5,
            '16nm': 5,
            '22nm': 3,
            '28nm': 2,
            '32nm': 2,
            '40nm': 1,
            '45nm': 1,
            '65nm': 0,
            '90nm': 0,
            '130nm': 0,
            '180nm': 0
          }
        }
      },
      timelineOnly: {
        summary: 'Timeline Only',
        description: 'Update only project timelines',
        value: {
          blockTimeline: [
            { id: 'block-1', name: '1 RTL Drop', rtl_drop_count: 1, months: 2 },
            { id: 'block-2', name: '2 RTL Drops', rtl_drop_count: 2, months: 4 },
            { id: 'block-3', name: '3 RTL Drops', rtl_drop_count: 3, months: 6 }
          ],
          fullChipTimeline: [
            { id: 'fc-1', name: '1 RTL Drop', rtl_drop_count: 1, months: 3 },
            { id: 'fc-2', name: '2 RTL Drops', rtl_drop_count: 2, months: 5 },
            { id: 'fc-3', name: '3 RTL Drops', rtl_drop_count: 3, months: 7 }
          ]
        }
      },
      blockGateCount: {
        summary: 'Block Gate Count Only',
        description: 'Update only block gate count parameters',
        value: {
          blockGateCount: {
            baseGateCount: 1.5,
            baseResource: 0.5,
            gateIncrementStep: 1.0,
            additionalResourcePercentage: 10,
            maxGateCount: 4.0
          }
        }
      },
      blockComplexity: {
        summary: 'Block Complexity Only',
        description: 'Update only block complexity factors',
        value: {
          blockComplexity: [
            { id: 'synthesis_complexity', name: 'Synthesis Complexity', resourcePercentage: 5, enabled: true, autoApplied: false }
          ]
        }
      },
      fullChip: {
        summary: 'Full Chip Only',
        description: 'Update only full chip configuration',
        value: {
          fullChip: {
            fixed: [
              { id: 'pnr', name: 'PnR (Place & Route)', resources: 1.0 },
              { id: 'ir-drop', name: 'IR Drop Analysis', resources: 0.5 }
            ],
            percentage: [
              { id: 'low-power-fullchip', name: 'Low Power - Full Chip', resourcePercentage: 10, enabled: true }
            ]
          }
        }
      },
      cost: {
        summary: 'Cost Only',
        description: 'Update only cost per resource per month',
        value: {
          costPerResourcePerMonth: 400000
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Configuration updated successfully',
    type: ConfigurationDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Validation failed - timeline or block gate count configuration is invalid'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin role required' 
  })
  async updateConfiguration(@Body() config: ConfigurationDto): Promise<Configuration> {
    try {
      // Log what we receive
      console.log('[ConfigController] Received config update request');
      console.log('[ConfigController] costPerResourcePerMonth:', config.costPerResourcePerMonth, 'type:', typeof config.costPerResourcePerMonth);
      console.log('Backend received config.blockGateCount:', config.blockGateCount);
      console.log('Backend received config.blockGateCount type:', typeof config.blockGateCount);
      console.log('Backend received config.blockGateCount keys:', config.blockGateCount ? Object.keys(config.blockGateCount) : 'null/undefined');
      
      // Normalize blockGateCount BEFORE validation to ensure all required fields are present
      this.normalizeBlockGateCount(config);
      
      console.log('After normalization config.blockGateCount:', config.blockGateCount);
      
      // Auto-generate names for timeline entries based on rtl_drop_count
      this.autoGenerateTimelineNames(config);
      
      // Validate timeline configuration
      this.validateTimelineConfiguration(config);
      
      // Validate block gate count configuration
      this.validateBlockGateCountConfiguration(config);
      
      const result = await this.configService.updateConfiguration(config as Configuration);
      console.log('[ConfigController] Configuration updated successfully');
      return result;
    } catch (error) {
      console.error('[ConfigController] Error updating configuration:', error);
      console.error('[ConfigController] Error message:', error?.message);
      console.error('[ConfigController] Error stack:', error?.stack);
      
      // If it's already a BadRequestException or other HTTP exception, re-throw it
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Otherwise, wrap it in a BadRequestException with a descriptive message
      const errorMessage = error?.message || 'Unknown error occurred while updating configuration';
      console.error('[ConfigController] Wrapping error as BadRequestException:', errorMessage);
      throw new BadRequestException(`Failed to update configuration: ${errorMessage}`);
    }
  }

  @Patch('reset')
  @ApiOperation({ 
    summary: 'Update configuration values (Partial Update)',
    description: 'Update ANY of the 6 configuration sections from Admin UI. This endpoint supports partial updates - you can update one or more sections at a time:\n\n1️⃣ **Project Timeline** - blockTimeline, fullChipTimeline\n2️⃣ **Block Gate Count** - baseGateCount, baseResource, gateIncrementStep, additionalResourcePercentage, maxGateCount\n3️⃣ **Block Complexity** - All 11 complexity factors with percentages\n4️⃣ **Full Chip** - Fixed factors, percentage factors, levels\n5️⃣ **DFT** - CAD/Flow resources\n6️⃣ **Cost Settings** - costPerResourcePerMonth\n\n**Note:** Only provided fields will be updated, other sections will be preserved. Use GET /admin/config first to see current values.'
  })
  @ApiBody({ 
    type: ConfigurationDto,
    description: 'Partial configuration object. ALL parameters are optional - only provided fields will be updated, others will be preserved.',
    examples: {
      updateTimeline: {
        summary: 'Update Timeline Only',
        description: 'Update only project timelines',
        value: {
          blockTimeline: [
            { id: 'block-1', name: '1 RTL Drop', rtl_drop_count: 1, months: 2 },
            { id: 'block-2', name: '2 RTL Drops', rtl_drop_count: 2, months: 4 },
            { id: 'block-3', name: '3 RTL Drops', rtl_drop_count: 3, months: 6 }
          ],
          fullChipTimeline: [
            { id: 'fc-1', name: '1 RTL Drop', rtl_drop_count: 1, months: 3 },
            { id: 'fc-2', name: '2 RTL Drops', rtl_drop_count: 2, months: 5 },
            { id: 'fc-3', name: '3 RTL Drops', rtl_drop_count: 3, months: 7 }
          ]
        }
      },
      updateBlockGateCount: {
        summary: 'Update Block Gate Count Only',
        description: 'Update only block gate count parameters',
        value: {
          blockGateCount: {
            baseGateCount: 1.5,
            baseResource: 0.5,
            gateIncrementStep: 1.0,
            additionalResourcePercentage: 10,
            maxGateCount: 4.0
          }
        }
      },
      updateBlockComplexity: {
        summary: 'Update Block Complexity Only',
        description: 'Update only block complexity factors',
        value: {
          blockComplexity: [
            { id: 'synthesis_complexity', name: 'Synthesis Complexity', resourcePercentage: 5, enabled: true, autoApplied: false }
          ]
        }
      },
      updateFullChip: {
        summary: 'Update Full Chip Only',
        description: 'Update only full chip configuration',
        value: {
          fullChip: {
            fixed: [
              { id: 'pnr', name: 'PnR (Place & Route)', resources: 1.0 },
              { id: 'ir-drop', name: 'IR Drop Analysis', resources: 0.5 }
            ],
            percentage: [
              { id: 'low-power-fullchip', name: 'Low Power - Full Chip', resourcePercentage: 10, enabled: true }
            ]
          }
        }
      },
      updateDFT: {
        summary: 'Update DFT Only',
        description: 'Update only DFT configuration',
        value: {
          dft: {
            cadFlow: { id: 'dft-cad', name: 'DFT CAD/Flow', resources: 1.0 }
          }
        }
      },
      updateCost: {
        summary: 'Update Cost Only',
        description: 'Update only cost per resource per month',
        value: {
          costPerResourcePerMonth: 400000
        }
      },
      updateMultiple: {
        summary: 'Update Multiple Sections',
        description: 'Update multiple sections at once',
        value: {
          blockGateCount: {
            baseGateCount: 1.5,
            baseResource: 0.5,
            gateIncrementStep: 1.0,
            additionalResourcePercentage: 10,
            maxGateCount: 4.0
          },
          costPerResourcePerMonth: 400000
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Configuration updated successfully',
    type: ConfigurationDto
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Validation failed - timeline or block gate count configuration is invalid'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin role required' 
  })
  async updateConfigurationPartial(@Body() config: ConfigurationDto): Promise<Configuration> {
    // Log what we receive
    console.log('Backend received partial update config:', config);
    
    // Normalize blockGateCount BEFORE validation to ensure all required fields are present
    if (config.blockGateCount) {
      this.normalizeBlockGateCount(config);
    }
    
    // Auto-generate names for timeline entries based on rtl_drop_count
    if (config.blockTimeline || config.fullChipTimeline) {
      this.autoGenerateTimelineNames(config);
    }
    
    // Validate timeline configuration only if timeline is being updated
    if (config.blockTimeline || config.fullChipTimeline) {
      this.validateTimelineConfiguration(config);
    }
    
    // Validate block gate count configuration only if blockGateCount is being updated
    if (config.blockGateCount) {
      this.validateBlockGateCountConfiguration(config);
    }
    
    return await this.configService.updateConfiguration(config as Configuration);
  }

  @Post('reset')
  @ApiOperation({ 
    summary: 'Reset configuration to defaults',
    description: 'Reset ALL configuration to default values from default-config.ts. This will overwrite all current settings including timelines, block complexity, full chip factors, and cost settings. Use with caution!'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Configuration reset to defaults successfully',
    type: ConfigurationDto
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Admin role required' 
  })
  async resetConfiguration(): Promise<Configuration> {
    return this.configService.resetConfiguration();
  }

  /**
   * Normalizes blockGateCount to ensure all required fields are present with defaults
   */
  private normalizeBlockGateCount(config: ConfigurationDto): void {
    console.log('normalizeBlockGateCount called, config.blockGateCount:', config.blockGateCount);
    
    if (!config.blockGateCount) {
      console.log('blockGateCount is missing, creating default');
      config.blockGateCount = {
        baseGateCount: 1.5,
        baseResource: 0.5,
        gateIncrementStep: 1.0,
        additionalResourcePercentage: 10,
        maxGateCount: 4.5,
      };
      return;
    }

    const bgc = config.blockGateCount;
    console.log('bgc before normalization:', bgc);
    console.log('bgc.baseGateCount:', bgc.baseGateCount, 'type:', typeof bgc.baseGateCount);
    
    // Ensure all fields are numbers and have valid values
    const normalized = {
      baseGateCount: (bgc.baseGateCount != null && !isNaN(Number(bgc.baseGateCount)) && Number(bgc.baseGateCount) > 0) 
        ? Number(bgc.baseGateCount) 
        : 1.5,
      baseResource: (bgc.baseResource != null && !isNaN(Number(bgc.baseResource)) && Number(bgc.baseResource) > 0) 
        ? Number(bgc.baseResource) 
        : 0.5,
      gateIncrementStep: (bgc.gateIncrementStep != null && !isNaN(Number(bgc.gateIncrementStep)) && Number(bgc.gateIncrementStep) > 0) 
        ? Number(bgc.gateIncrementStep) 
        : 1.0,
      additionalResourcePercentage: (bgc.additionalResourcePercentage != null && !isNaN(Number(bgc.additionalResourcePercentage)) && Number(bgc.additionalResourcePercentage) >= 0) 
        ? Number(bgc.additionalResourcePercentage) 
        : 10,
      maxGateCount: (bgc.maxGateCount != null && !isNaN(Number(bgc.maxGateCount)) && Number(bgc.maxGateCount) > 0) 
        ? Number(bgc.maxGateCount) 
        : 4.5,
    };
    
    console.log('normalized blockGateCount:', normalized);
    config.blockGateCount = normalized;
  }

  /**
   * Auto-generates timeline entry names based on rtl_drop_count.
   * Names are for display purposes only and are not used in calculations.
   */
  private autoGenerateTimelineNames(config: ConfigurationDto): void {
    // Auto-generate names for block timeline
    if (config.blockTimeline) {
      config.blockTimeline.forEach(timeline => {
        if (timeline.rtl_drop_count) {
          timeline.name = `${timeline.rtl_drop_count} RTL Drop${timeline.rtl_drop_count > 1 ? 's' : ''}`;
        }
      });
    }

    // Auto-generate names for full chip timeline
    if (config.fullChipTimeline) {
      config.fullChipTimeline.forEach(timeline => {
        if (timeline.rtl_drop_count) {
          timeline.name = `${timeline.rtl_drop_count} RTL Drop${timeline.rtl_drop_count > 1 ? 's' : ''}`;
        }
      });
    }
  }

  /**
   * Validates timeline configuration according to requirements:
   * - rtl_drop_count must be one of {1, 2, 3}
   * - Exactly one timeline entry per rtl_drop_count
   * - duration_months must be > 0
   * - Block timeline list must contain all 3 RTL drop entries
   * - Full chip timeline list must contain all 3 RTL drop entries
   */
  private validateTimelineConfiguration(config: ConfigurationDto): void {
    // Validate block timeline
    this.validateTimelineList(config.blockTimeline, 'Block');

    // Validate full chip timeline
    this.validateTimelineList(config.fullChipTimeline, 'Full Chip');
  }

  private validateTimelineList(timeline: any[], timelineType: string): void {
    if (!timeline || timeline.length === 0) {
      throw new BadRequestException(`${timelineType} timeline list cannot be empty`);
    }

    // Check that all 3 RTL drop entries are present
    const requiredDropCounts = [1, 2, 3];
    const foundDropCounts = new Set<number>();

    for (const entry of timeline) {
      // Validate rtl_drop_count
      if (![1, 2, 3].includes(entry.rtl_drop_count)) {
        throw new BadRequestException(
          `${timelineType} timeline: rtl_drop_count must be 1, 2, or 3. Found: ${entry.rtl_drop_count}`
        );
      }

      // Check for duplicates
      if (foundDropCounts.has(entry.rtl_drop_count)) {
        throw new BadRequestException(
          `${timelineType} timeline: Duplicate rtl_drop_count ${entry.rtl_drop_count}. Exactly one entry per rtl_drop_count is required.`
        );
      }
      foundDropCounts.add(entry.rtl_drop_count);

      // Validate duration_months > 0
      if (!entry.months || entry.months <= 0) {
        throw new BadRequestException(
          `${timelineType} timeline: duration_months must be greater than 0. Found: ${entry.months} for rtl_drop_count ${entry.rtl_drop_count}`
        );
      }
    }

    // Check that all required drop counts are present
    const missingDropCounts = requiredDropCounts.filter(count => !foundDropCounts.has(count));
    if (missingDropCounts.length > 0) {
      throw new BadRequestException(
        `${timelineType} timeline: Missing required rtl_drop_count entries: ${missingDropCounts.join(', ')}. All three entries (1, 2, 3) must be present.`
      );
    }
  }

  /**
   * Validates Block Gate Count configuration:
   * - base_gate_count, base_resource, gate_increment_step must be > 0
   * - additional_resource_percentage must be >= 0
   * - max_gate_count must be > 0 and >= base_gate_count
   */
  private validateBlockGateCountConfiguration(config: ConfigurationDto): void {
    console.log('Validating blockGateCount, config.blockGateCount:', config.blockGateCount);
    console.log('config.blockGateCount type:', typeof config.blockGateCount);
    
    if (!config.blockGateCount) {
      console.error('blockGateCount is missing!');
      throw new BadRequestException('Block Gate Count configuration is required');
    }

    const bgc = config.blockGateCount;
    console.log('bgc object:', bgc);
    console.log('bgc.baseGateCount:', bgc.baseGateCount);
    console.log('bgc.baseGateCount type:', typeof bgc.baseGateCount);

    // Validate base_gate_count > 0
    if (!bgc.baseGateCount || bgc.baseGateCount <= 0) {
      console.error('baseGateCount validation failed!', {
        baseGateCount: bgc.baseGateCount,
        type: typeof bgc.baseGateCount,
        isNull: bgc.baseGateCount === null,
        isUndefined: bgc.baseGateCount === undefined,
        keys: Object.keys(bgc),
      });
      throw new BadRequestException(
        `Block Gate Count: baseGateCount must be greater than 0. Found: ${bgc.baseGateCount}`
      );
    }

    // Validate base_resource > 0
    if (!bgc.baseResource || bgc.baseResource <= 0) {
      throw new BadRequestException(
        `Block Gate Count: baseResource must be greater than 0. Found: ${bgc.baseResource}`
      );
    }

    // Validate gate_increment_step > 0
    if (!bgc.gateIncrementStep || bgc.gateIncrementStep <= 0) {
      throw new BadRequestException(
        `Block Gate Count: gateIncrementStep must be greater than 0. Found: ${bgc.gateIncrementStep}`
      );
    }

    // Validate additional_resource_percentage >= 0
    if (bgc.additionalResourcePercentage === undefined || bgc.additionalResourcePercentage < 0) {
      throw new BadRequestException(
        `Block Gate Count: additionalResourcePercentage must be >= 0. Found: ${bgc.additionalResourcePercentage}`
      );
    }

    // Validate max_gate_count > 0
    if (!bgc.maxGateCount || bgc.maxGateCount <= 0) {
      throw new BadRequestException(
        `Block Gate Count: maxGateCount must be greater than 0. Found: ${bgc.maxGateCount}`
      );
    }

    // Validate max_gate_count >= base_gate_count (logical constraint)
    if (bgc.maxGateCount < bgc.baseGateCount) {
      throw new BadRequestException(
        `Block Gate Count: maxGateCount (${bgc.maxGateCount}) must be >= baseGateCount (${bgc.baseGateCount})`
      );
    }
  }

}

