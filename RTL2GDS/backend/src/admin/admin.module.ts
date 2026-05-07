import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminProjectTimeline } from './entities/admin-project-timeline.entity';
import { AdminPricingFactor } from './entities/admin-pricing-factor.entity';
import { AdminCostSetting } from './entities/admin-cost-setting.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminProjectTimeline,
      AdminPricingFactor,
      AdminCostSetting,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class AdminModule {}

