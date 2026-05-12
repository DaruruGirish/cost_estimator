import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { EstimationModule } from './estimation/estimation.module';
import { UserModule } from './user/user.module';
import { ProjectModule } from './project/project.module';
import { User } from './user/entities/user.entity';
import { Project } from './project/entities/project.entity';
import { ProjectBlock } from './project/entities/project-block.entity';
import { ProjectSelectedFactor } from './project/entities/project-selected-factor.entity';
import { ProjectDftCadFlow } from './project/entities/project-dft-cad-flow.entity';
import { ProjectCostBreakdown } from './project/entities/project-cost-breakdown.entity';
import { AdminProjectTimeline } from './admin/entities/admin-project-timeline.entity';
import { AdminPricingFactor } from './admin/entities/admin-pricing-factor.entity';
import { AdminCostSetting } from './admin/entities/admin-cost-setting.entity';
import { LeadModule } from './lead/lead.module';
import { Lead } from './lead/entities/lead.entity';
import { EmailModule } from './email/email.module';
@Module({
  imports: [
    // Load environment variables from .env file
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'rtlgds',
      entities: [
        User,
        Project,
        ProjectBlock,
        ProjectSelectedFactor,
        ProjectDftCadFlow,
        ProjectCostBreakdown,
        AdminProjectTimeline,
        AdminPricingFactor,
        AdminCostSetting,
        Lead,
      ],
      synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables (set to false in production)
      logging: false, // Enable logging to see connection details
      retryAttempts: 1, // Reduce retries for faster failure feedback
      retryDelay: 1000,
    }),
    AuthModule,
    ConfigModule,
    EstimationModule,
    UserModule,
    ProjectModule,
    LeadModule,
    EmailModule,
  ],
})
export class AppModule {}

