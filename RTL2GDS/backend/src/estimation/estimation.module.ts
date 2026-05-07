import { Module } from '@nestjs/common';
import { EstimationService } from './estimation.service';
import { EstimationController } from './estimation.controller';
import { FlatImplementationService } from './flat-implementation.service';
import { FullChipConfigurationService } from './full-chip-configuration.service';
import { ConfigModule } from '../config/config.module';
import { AuthModule } from '../auth/auth.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [ConfigModule, AuthModule, ProjectModule],
  controllers: [EstimationController],
  providers: [EstimationService, FlatImplementationService, FullChipConfigurationService],
})
export class EstimationModule {}

