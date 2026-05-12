import { Controller, Get, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from './config.service';
import { Configuration } from '../types';
import { ConfigurationDto } from './dto/configuration.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@ApiTags('config')
@Controller('config')
@UseGuards(JwtAuthGuard)
export class PublicConfigController {
  constructor(private configService: ConfigService) {}

  @Get()
  @Public()
  @ApiOperation({ 
    summary: 'Get current configuration (Public)',
    description: 'Retrieve the complete system configuration including project timelines, block settings, full chip factors, DFT options, and cost parameters. This endpoint is public and does not require authentication.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Returns the current system configuration',
    type: ConfigurationDto
  })
  async getConfiguration(): Promise<Configuration> {
    return this.configService.getConfiguration();
  }
}
