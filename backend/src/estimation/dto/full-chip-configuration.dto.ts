import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsArray, IsString, IsObject, IsNumber, IsIn, IsOptional } from 'class-validator';

export class FullChipConfigurationDto {
  @ApiProperty({
    description: 'Enable full chip configuration',
    example: true,
    type: Boolean
  })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Array of fixed full chip factor IDs. Available options: pnr (2.0 resources), ir_drop (0.5 resources), pv (1.5 resources), sta (1.5 resources)',
    example: ['pnr', 'ir_drop', 'pv', 'sta'],
    type: [String],
    required: false,
    default: []
  })
  @IsArray()
  @IsString({ each: true })
  factors: string[];

  @ApiProperty({
    description: 'Array of percentage-based full chip factor IDs (for simple checkbox factors). Available options: low_power_full_chip (10% increase), abutment_floorplan (10% increase), modes (10% increase), dft_top_level (30% increase)',
    example: [],
    type: [String],
    required: false,
    default: []
  })
  @IsArray()
  @IsString({ each: true })
  percentageFactors: string[];

  @ApiProperty({
    description: 'Percentage factor levels (for factors with multiple options). Key-value pairs where key is factorId and value is levelId. Available factors with levels: blocks_count (none, 9-18, 18-plus), io_pad_count (none, low, medium, high). Note: clock_distribution (mesh/MS-CTS) is a simple checkbox factor, not a level-based factor.',
    example: {},
    type: Object,
    required: false,
    default: {}
  })
  @IsObject()
  percentageFactorLevels: Record<string, string>;

  @ApiProperty({
    description: 'Enable DFT at top level',
    example: false,
    type: Boolean
  })
  @IsBoolean()
  dft: boolean;

  @ApiProperty({
    description: 'Enable DFT CAD/Flow',
    example: false,
    type: Boolean
  })
  @IsBoolean()
  cadFlow: boolean;

  @ApiProperty({
    description: 'RTL drop count (1, 2, or 3). Determines which timeline entry to use for duration calculation.',
    example: 3,
    type: Number,
    enum: [1, 2, 3]
  })
  @IsNumber()
  @IsIn([1, 2, 3])
  rtl_drop_count: 1 | 2 | 3;

  @ApiProperty({
    description: 'Blocks count tier for Full-Chip projects. Determines blocks scaling percentage: lt9 (0%), 9to18 (10%), gt18 (20%)',
    example: 'lt9',
    type: String,
    enum: ['lt9', '9to18', 'gt18'],
    required: false
  })
  @IsString()
  @IsIn(['lt9', '9to18', 'gt18'])
  @IsOptional()
  fullChipBlocksTier?: 'lt9' | '9to18' | 'gt18';

  @ApiProperty({
    description: 'Enable Glue Logic. If enabled, percentage scaling is applied based on instance count.',
    example: false,
    type: Boolean,
    required: false
  })
  @IsBoolean()
  @IsOptional()
  glueLogic?: boolean;

  @ApiProperty({
    description: 'Instance count for Glue Logic scaling. Used when glueLogic is true. Values: 1.5 (<1.5M), 2.5 (<2.5M), 3.5 (<3.5M), 4.5 (<4.5M)',
    example: 1.5,
    type: Number,
    required: false
  })
  @IsNumber()
  @IsOptional()
  instanceCount?: number;

  @ApiProperty({
    description: 'Number of blocks in the full chip. Used for blocks scaling calculation when blocks are not individually configured. Determines blocks_count level: ≤8=0%, 9-18=10%, >18=20%',
    example: 12,
    type: Number,
    required: false
  })
  @IsNumber()
  @IsOptional()
  numberOfBlocks?: number;
}

