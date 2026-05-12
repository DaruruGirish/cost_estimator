import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProjectConfigurationDto } from '../../estimation/dto/project-configuration.dto';

export class SaveProjectDto {
  @ApiProperty({
    description: 'Complete project configuration including blocks, full chip settings, and all complexity factors',
    type: ProjectConfigurationDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => ProjectConfigurationDto)
  projectConfig: ProjectConfigurationDto;

  @ApiProperty({
    description: 'Calculated total cost in ₹',
    example: 18000000,
    type: Number,
  })
  @IsNumber()
  calculatedCost: number;

  @ApiProperty({
    description: 'Calculated project duration in months',
    example: 7,
    type: Number,
  })
  @IsNumber()
  calculatedDuration: number;

  @ApiProperty({
    description: 'Optional cost breakdown details',
    required: false,
    example: {
      blockEffort: 0.75,
      fullChipEffort: 2.5,
      dftEffort: 1.0,
      totalEffort: 3.25,
      duration: 7,
    },
  })
  @IsOptional()
  @IsObject()
  breakdown?: {
    blockEffort: number;
    fullChipEffort: number;
    dftEffort: number;
    totalEffort: number;
    duration: number;
  };
}

