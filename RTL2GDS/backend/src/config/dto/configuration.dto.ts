import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsIn, Min, IsOptional, ValidateNested, IsArray, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectTimelineDto {
  @ApiProperty({ type: String, description: 'Unique identifier for the timeline entry' })
  @IsString()
  id: string;

  @ApiProperty({ type: String, description: 'Display name for the timeline (e.g., "3 RTL Drops")' })
  @IsString()
  name: string;

  @ApiProperty({ 
    type: Number, 
    enum: [1, 2, 3],
    description: 'RTL drop count (1, 2, or 3). REQUIRED for logic.',
    example: 3
  })
  @IsNumber()
  @IsIn([1, 2, 3])
  rtl_drop_count: 1 | 2 | 3;

  @ApiProperty({ type: Number, description: 'Duration in months (must be > 0)', example: 6 })
  @IsNumber()
  @Min(0.01, { message: 'Duration must be greater than 0' })
  months: number;
}

export class BlockGateCountDto {
  @ApiProperty({ 
    type: Number, 
    description: 'Base gate count in millions',
    example: 1.5
  })
  @IsNumber()
  @IsOptional()
  baseGateCount?: number;

  @ApiProperty({ 
    type: Number, 
    description: 'Base resource effort',
    example: 0.5
  })
  @IsNumber()
  @IsOptional()
  baseResource?: number;

  @ApiProperty({ 
    type: Number, 
    description: 'Gate increment step in millions (gate size step for scaling effort)',
    example: 1.0
  })
  @IsNumber()
  @IsOptional()
  gateIncrementStep?: number;

  @ApiProperty({ 
    type: Number, 
    description: 'Additional resource percentage per increment step',
    example: 10
  })
  @IsNumber()
  @IsOptional()
  additionalResourcePercentage?: number;

  @ApiProperty({ 
    type: Number, 
    description: 'Maximum gate count in millions (gate counts above this require manual review)',
    example: 4.0
  })
  @IsNumber()
  @IsOptional()
  maxGateCount?: number;
}

export class BlockComplexityFactorLevelDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  label: string;

  @ApiProperty({ type: Number })
  resourcePercentage: number;
}

export class BlockComplexityFactorDto {
  @ApiProperty({ type: String, description: 'Unique identifier for the factor (required)' })
  @IsString()
  id: string;

  @ApiProperty({ type: String, description: 'Display name for the factor (required)' })
  @IsString()
  name: string;

  @ApiProperty({ type: Number, description: 'Resource percentage for this factor' })
  @IsNumber()
  resourcePercentage: number;

  @ApiProperty({ type: Boolean, required: false, default: true })
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ type: Boolean, required: false, default: false })
  @IsOptional()
  autoApplied?: boolean;

  @ApiProperty({ type: [BlockComplexityFactorLevelDto], required: false })
  levels?: BlockComplexityFactorLevelDto[];
}

export class FullChipFactorDto {
  @ApiProperty({ type: String, description: 'Unique identifier for the factor (required)' })
  @IsString()
  id: string;

  @ApiProperty({ type: String, description: 'Display name for the factor (required)' })
  @IsString()
  name: string;

  @ApiProperty({ type: Number, description: 'Fixed resource value for this factor' })
  @IsNumber()
  resources: number;
}

export class FullChipPercentageFactorLevelDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  label: string;

  @ApiProperty({ type: Number })
  resourcePercentage: number;

  @ApiProperty({ type: Boolean, required: false, default: false })
  @IsOptional()
  locked?: boolean;
}

export class FullChipPercentageFactorDto {
  @ApiProperty({ type: String, description: 'Unique identifier for the factor (required)' })
  @IsString()
  id: string;

  @ApiProperty({ type: String, description: 'Display name for the factor (required)' })
  @IsString()
  name: string;

  @ApiProperty({ type: Number, description: 'Resource percentage for this factor' })
  @IsNumber()
  resourcePercentage: number;

  @ApiProperty({ type: Boolean, required: false, default: true })
  @IsOptional()
  enabled?: boolean;

  @ApiProperty({ type: Boolean, required: false, default: false })
  @IsOptional()
  autoApplied?: boolean;

  @ApiProperty({ type: [FullChipPercentageFactorLevelDto], required: false })
  levels?: FullChipPercentageFactorLevelDto[];
}

export class DFTFactorDto {
  @ApiProperty({ type: String, description: 'Unique identifier for the factor (required)' })
  @IsString()
  id: string;

  @ApiProperty({ type: String, description: 'Display name for the factor (required)' })
  @IsString()
  name: string;

  @ApiProperty({ type: Number, description: 'Fixed resource value for this factor' })
  @IsNumber()
  resources: number;
}

export class FullChipConfigDto {
  @ApiProperty({ type: [FullChipFactorDto] })
  fixed: FullChipFactorDto[];

  @ApiProperty({ type: [FullChipPercentageFactorDto] })
  percentage: FullChipPercentageFactorDto[];
}

export class DFTConfigDto {
  @ApiProperty({ type: DFTFactorDto })
  cadFlow: DFTFactorDto;
}

export class DftContextPercentagesDto {
  @ApiProperty({ 
    type: Number, 
    description: 'DFT percentage when DFT alone (no IO, no Analog)',
    example: 60,
    required: false
  })
  @IsOptional()
  @IsNumber()
  dftAlone?: number;

  @ApiProperty({ 
    type: Number, 
    description: 'DFT percentage when DFT with IO OR Analog (but not both)',
    example: 70,
    required: false
  })
  @IsOptional()
  @IsNumber()
  dftWithIoOrAnalog?: number;

  @ApiProperty({ 
    type: Number, 
    description: 'DFT percentage when DFT with IO AND Analog',
    example: 80,
    required: false
  })
  @IsOptional()
  @IsNumber()
  dftWithIoAndAnalog?: number;
}

export class ConfigurationDto {
  // 1. Project Timeline Section
  @ApiProperty({ type: [ProjectTimelineDto], description: 'Timeline configuration for blocks (Section 1 of 6)', required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectTimelineDto)
  @IsOptional()
  blockTimeline?: ProjectTimelineDto[];

  @ApiProperty({ type: [ProjectTimelineDto], description: 'Timeline configuration for full chip (Section 1 of 6)', required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectTimelineDto)
  @IsOptional()
  fullChipTimeline?: ProjectTimelineDto[];

  // 2. Block Gate Count Section
  @ApiProperty({ type: BlockGateCountDto, description: 'Block Gate Count configuration (Section 2 of 6)', required: false })
  @ValidateNested()
  @Type(() => BlockGateCountDto)
  @IsOptional()
  blockGateCount?: BlockGateCountDto;

  // 3. Block Complexity Section
  @ApiProperty({ type: [BlockComplexityFactorDto], description: 'Block Complexity factors (Section 3 of 6)', required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlockComplexityFactorDto)
  @IsOptional()
  blockComplexity?: BlockComplexityFactorDto[];

  // 4. Full Chip Section
  @ApiProperty({ type: FullChipConfigDto, description: 'Full Chip configuration (Section 4 of 6)', required: false })
  @ValidateNested()
  @Type(() => FullChipConfigDto)
  @IsOptional()
  fullChip?: FullChipConfigDto;

  // 5. DFT Section
  @ApiProperty({ type: DFTConfigDto, description: 'DFT configuration (Section 5 of 6)', required: false })
  @ValidateNested()
  @Type(() => DFTConfigDto)
  @IsOptional()
  dft?: DFTConfigDto;

  // 6. Cost Settings Section
  @ApiProperty({ type: Number, description: 'Cost per resource per month (Section 6 of 6)', required: false, example: 400000 })
  @Type(() => Number)
  @IsNumber({}, { message: 'costPerResourcePerMonth must be a valid number' })
  @Min(0, { message: 'costPerResourcePerMonth must be greater than or equal to 0' })
  @IsOptional()
  costPerResourcePerMonth?: number;

  // Additional (not in main 6 sections)
  @ApiProperty({
    type: Object,
    description: 'Technology node multipliers as key-value pairs (e.g., { "2nm": 0.15, "7nm": 0.09, ... })',
    example: { '2nm': 0.15, '3nm': 0.13, '5nm': 0.11, '7nm': 0.09, '10nm': 0.07, '14nm': 0.05, '22nm': 0.03, '28nm': 0.02, '40nm': 0.01, '65nm': 0.0, '90nm': 0.0, '130nm': 0.0, '180nm': 0.0 },
    required: false
  })
  @IsObject()
  @IsOptional()
  technologyNodeMultipliers?: Record<string, number>;

  // DFT Context Percentages
  @ApiProperty({ type: DftContextPercentagesDto, description: 'DFT context-based percentages', required: false })
  @ValidateNested()
  @Type(() => DftContextPercentagesDto)
  @IsOptional()
  dftContextPercentages?: DftContextPercentagesDto;
}

