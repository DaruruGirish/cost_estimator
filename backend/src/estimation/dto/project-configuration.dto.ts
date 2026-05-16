import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, ValidateNested, IsArray, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { FullChipConfigurationDto } from './full-chip-configuration.dto';
import { BlockConfigurationDto } from './block-configuration.dto';

export class ProjectConfigurationDto {
  @ApiProperty({
    description: 'Project name',
    example: 'SoC Design Project',
    type: String,
    required: true
  })
  @IsString()
  projectName: string;

  @ApiProperty({
    description: 'Customer name (optional - not stored, user info comes from JWT token)',
    example: 'John Doe',
    type: String,
    required: false
  })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiProperty({
    description: 'Customer email ID (optional - not stored, user info comes from JWT token)',
    example: 'john.doe@example.com',
    type: String,
    required: false,
    format: 'email'
  })
  @IsString()
  @IsOptional()
  emailId?: string;

  @ApiProperty({
    description: 'Technology node (180nm to 2nm). Technology node multiplier is automatically applied globally to the total effort based on this value. No need to include tech-node in complexity factors.',
    example: '7nm',
    type: String,
    enum: ['180nm', '130nm', '90nm', '65nm', '45nm', '32nm', '28nm', '22nm', '16nm', '14nm', '12nm', '10nm', '7nm', '5nm', '3nm', '2nm'],
    required: false,
    nullable: true
  })
  @IsString()
  technology: string;

  @ApiProperty({
    description: 'Full chip configuration. Available fixed factors: pnr, ir_drop, pv, sta. Available percentage factors: low_power_full_chip, abutment_floorplan. RTL drop count: 1, 2, or 3.',
    type: FullChipConfigurationDto,
    example: {
      enabled: true,
      factors: ['pnr', 'ir_drop', 'pv', 'sta'],
      percentageFactors: ['low_power_full_chip', 'abutment_floorplan'],
      dft: true,
      cadFlow: false,
      rtl_drop_count: 3
    }
  })
  @ValidateNested()
  @Type(() => FullChipConfigurationDto)
  fullChip: FullChipConfigurationDto;

  @ApiProperty({
    description: `Array of block configurations. Available complexity factors: synthesis-complexity, new-design, low-power-non-nested, low-power-nested, physical-blocks, macro-intensive, io-blocks, merged-mode, dft-block-level. Note: Technology node multiplier is applied automatically based on the project technology field. Low-power nested and non-nested are mutually exclusive (nested takes precedence if both are selected). RTL drop count: 1, 2, or 3.`,
    type: [BlockConfigurationDto],
    example: [
      {
        gateCount: 1.5,
        complexityFactors: ['synthesis-complexity', 'new-design', 'low-power-non-nested', 'physical-blocks', 'macro-intensive', 'io-blocks', 'merged-mode'],
        dft: false,
        additionalFactors: { 'io_pad_count': 'medium' }, // Note: clock_distribution (mesh/MS-CTS) is a simple checkbox in percentageFactors, not a level-based factor
        rtl_drop_count: 3
      }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockConfigurationDto)
  blocks: BlockConfigurationDto[];

  @ApiProperty({
    description: 'Project-level additional factors as key-value pairs - DEPRECATED: Not used in calculations',
    example: {},
    type: Object,
    required: false,
    default: {}
  })
  @IsOptional()
  @IsObject()
  additionalFactors?: Record<string, string>;

  @ApiProperty({
    description: 'If true, automatically save the project to database after calculation. Default: false',
    example: false,
    type: Boolean,
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  save?: boolean;

  @ApiProperty({
    description: 'Flag for Flat implementation (vs hierarchical). If true, design is flat (no hierarchical overhead).',
    example: false,
    type: Boolean,
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  isFlat?: boolean;
}

