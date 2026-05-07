import { Controller, Post, Body, Request, SetMetadata, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { EstimationService } from './estimation.service';
import { ProjectConfiguration } from '../types';
import { ProjectConfigurationDto } from './dto/project-configuration.dto';
import { ProjectService } from '../project/project.service';
import { UnauthorizedException } from '@nestjs/common';

const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags('estimation')
@Controller('estimation')
@UseGuards(JwtAuthGuard)
export class EstimationController {
  constructor(
    private estimationService: EstimationService,
    private projectService: ProjectService,
  ) {}

  @Post('calculate')
  @Public()
  @ApiOperation({ 
    summary: 'Calculate project cost and duration (optionally save)',
    description: 'Calculate the total cost and duration for an RTLGDS project based on blocks, full chip configuration, and various complexity factors. The cost is calculated as: total_effort × ₹4L per resource-month. Duration uses Full Chip timeline if enabled, otherwise Block timeline. Duration is informational only and does not affect cost calculation. Requires valid JWT token.\n\n**💾 Auto-save Feature:** Include `"save": true` in the request body to automatically save the project to the database after calculation. This is the **primary way to save projects** - no separate endpoint needed!\n\n**Tip:** Click "Try it out" and use the example JSON below as a starting point. Modify the values as needed.'
  })
  @ApiBody({ 
    type: ProjectConfigurationDto,
    description: 'Complete project configuration including blocks, full chip settings, and all complexity factors',
    examples: {
      minimal: {
        summary: 'Minimal Example (Single Block)',
        description: 'Simplest configuration with one block',
        value: {
          projectName: 'Simple SoC Project',
          customerName: 'John Doe',
          emailId: 'john@example.com',
          technology: '7nm',
          fullChip: {
            enabled: false,
            factors: [],
            percentageFactors: [],
            percentageFactorLevels: {},
            dft: false,
            cadFlow: false,
            rtl_drop_count: 3
          },
          blocks: [
            {
              blockName: 'CPU Core',
              gateCount: 1.5,
              complexityFactors: [],
              complexityFactorLevels: {},
              dft: false,
              rtl_drop_count: 3
            }
          ]
        }
      },
      fullChip: {
        summary: 'Full Chip Example',
        description: 'Complete configuration with full chip enabled',
        value: {
          projectName: 'Advanced SoC Design',
          customerName: 'Jane Smith',
          emailId: 'jane@example.com',
          technology: '5nm',
          fullChip: {
            enabled: true,
            factors: ['pnr', 'ir_drop', 'pv', 'sta'],
            percentageFactors: ['low_power_full_chip', 'abutment_floorplan'],
            percentageFactorLevels: {
              'blocks_count': '9-18',
              'clock_distribution': 'complex', // Note: clock_distribution is "mesh/MS-CTS" in UI
              'io_pad_count': 'high'
            },
            dft: true,
            cadFlow: false,
            rtl_drop_count: 3
          },
          blocks: [
            {
              blockName: 'CPU Core',
              gateCount: 2.5,
              complexityFactors: ['synthesis-complexity', 'new-design', 'physical-blocks'],
              complexityFactorLevels: {},
              dft: false,
              rtl_drop_count: 3
            },
            {
              blockName: 'GPU Core',
              gateCount: 3.0,
              complexityFactors: ['new-design', 'low-power-nested', 'macro-intensive'],
              complexityFactorLevels: {},
              dft: true,
              rtl_drop_count: 2
            }
          ]
        }
      },
      withSave: {
        summary: 'Calculate and Save Example',
        description: 'Calculate cost AND automatically save the project to database. Set save: true to store the project details.',
        value: {
          projectName: 'Test SoC Project',
          customerName: 'Test Customer',
          emailId: 'customer@test.com',
          technology: '7nm',
          fullChip: {
            enabled: true,
            factors: ['pnr', 'ir_drop', 'pv', 'sta'],
            percentageFactors: ['low_power_full_chip'],
            percentageFactorLevels: {
              'blocks_count': '9-18',
              'clock_distribution': 'complex' // Note: clock_distribution is "mesh/MS-CTS" in UI
            },
            dft: false,
            cadFlow: false,
            rtl_drop_count: 3
          },
          blocks: [
            {
              blockName: 'CPU Core',
              gateCount: 2.5,
              complexityFactors: ['synthesis-complexity', 'new-design'],
              complexityFactorLevels: {},
              dft: false,
              rtl_drop_count: 3
            }
          ],
          save: true
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the calculated price and months for the project',
    schema: {
      type: 'object',
      properties: {
        months: {
          type: 'number',
          description: 'Project duration in months',
          example: 7
        },
        price: {
          type: 'number',
          description: 'Total estimated price in ₹',
          example: 18000000
        },
        projectId: {
          type: 'number',
          description: 'Project ID (only when save=true)',
          example: 123
        },
        saved: {
          type: 'boolean',
          description: 'Whether the project was saved (only when save=true)',
          example: true
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized - Invalid or missing JWT token' 
  })
  @ApiResponse({
    status: 201,
    description: 'Project calculated and saved successfully (when save=true)',
  })
  async calculateCost(
    @Body() body: ProjectConfigurationDto & { save?: boolean },
    @Request() req: any,
  ): Promise<{ 
    months: number;
    price: number;
    projectId?: number;
    saved?: boolean;
  }> {
    const { save, ...projectConfig } = body;
    
    // Calculate cost
    const result = this.estimationService.calculateCost(projectConfig as ProjectConfiguration);
    
    // If save=true, also save the project (customerName and emailId are stored even without authentication)
    if (save) {
      const userId = req.user?.userId || null; // Optional - customer details are stored directly in project
      
      const savedProject = await this.projectService.createProject(
        projectConfig as ProjectConfiguration,
        result.price,
        result.months,
        null, // breakdown is optional and not needed for simplified response
        userId,
      );
      
      return {
        ...result,
        projectId: savedProject.id,
        saved: true,
      };
    }
    
    return result;
  }
}

