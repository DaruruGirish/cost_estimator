import { ApiProperty } from '@nestjs/swagger';

export class ProjectBlockResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'CPU Core' })
  blockName: string;

  @ApiProperty({ example: 2.5 })
  gateCountMillion: number;

  @ApiProperty({ example: 3, nullable: true })
  rtlDrops: number | null;

  @ApiProperty({ example: 'none', enum: ['none', 'non_nested', 'nested'], nullable: true })
  lowPowerType: 'none' | 'non_nested' | 'nested' | null;
}

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'John Doe' })
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: 'customer', enum: ['admin', 'customer'] })
  role: string;

  @ApiProperty({ example: true, nullable: true })
  isActive: boolean | null;
}

export class ProjectResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Advanced SoC Design' })
  projectName: string;

  @ApiProperty({ example: '7nm', nullable: true })
  technologyNode: string | null;

  @ApiProperty({ example: true, nullable: true })
  isFullChip: boolean | null;

  @ApiProperty({ example: 3, nullable: true })
  numberOfBlocks: number | null;

  @ApiProperty({ example: 18000000, nullable: true })
  estimatedCost: number | null;

  @ApiProperty({ example: 7, nullable: true })
  estimatedDurationMonths: number | null;

  @ApiProperty({ type: UserResponseDto, nullable: true })
  user: UserResponseDto | null;

  @ApiProperty({ type: [ProjectBlockResponseDto] })
  blocks: ProjectBlockResponseDto[];

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;
}

