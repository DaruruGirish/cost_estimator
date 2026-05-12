import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsArray, IsBoolean, IsString, IsObject, ValidateNested, IsOptional, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class BlockConfigurationDto {
  @ApiProperty({
    description: 'Block name',
    example: 'Block 1',
    type: String,
    required: false
  })
  @IsOptional()
  @IsString()
  blockName?: string;

  @ApiProperty({
    description: 'Gate count in millions',
    example: 1.5,
    type: Number
  })
  @IsNumber()
  gateCount: number;

  @ApiProperty({
    description: 'Array of complexity factor IDs (for simple checkbox factors). Available options: synthesis-complexity, new-design, low-power-non-nested, low-power-nested, physical-blocks, macro-intensive, io-blocks, merged-mode, dft-block-level. **REQUIRED:** Must include either "hierarchical" or "flat" design type. Note: Technology node multiplier is applied automatically based on the project technology field, not as a complexity factor.',
    example: ['synthesis-complexity', 'new-design', 'hierarchical'],
    type: [String],
    required: false,
    default: []
  })
  @IsArray()
  @IsString({ each: true })
  complexityFactors: string[];

  @ApiProperty({
    description: 'Complexity factor levels (for factors with multiple options). Key-value pairs where key is factorId and value is levelId. Currently no factors use levels.',
    example: {},
    type: Object,
    required: false,
    default: {}
  })
  @IsObject()
  complexityFactorLevels: Record<string, string>;

  @ApiProperty({
    description: 'Enable DFT for this block',
    example: false,
    type: Boolean
  })
  @IsBoolean()
  dft: boolean;

  @ApiProperty({
    description: 'Additional factors as key-value pairs (factorId: levelId) - DEPRECATED: Not used in calculations',
    example: {},
    type: Object,
    required: false,
    default: {}
  })
  @IsOptional()
  @IsObject()
  additionalFactors?: Record<string, string>;

  @ApiProperty({
    description: 'RTL drop count (1, 2, or 3). Determines which timeline entry to use for duration calculation.',
    example: 3,
    type: Number,
    enum: [1, 2, 3]
  })
  @IsNumber()
  @IsIn([1, 2, 3])
  rtl_drop_count: 1 | 2 | 3;
}

