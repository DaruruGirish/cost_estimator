import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { PublicConfigController } from './public-config.controller';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [AdminModule],
  controllers: [ConfigController, PublicConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}

