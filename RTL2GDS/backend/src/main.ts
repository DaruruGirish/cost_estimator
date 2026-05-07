import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // Log database connection info (without password)
  console.log('📊 Database Configuration:');
  console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`   Port: ${process.env.DB_PORT || '5432'}`);
  console.log(`   Username: ${process.env.DB_USERNAME || 'postgres'}`);
  console.log(`   Database: ${process.env.DB_NAME || 'rtlgds'}`);
  console.log(`   Password: ${process.env.DB_PASSWORD ? '***' : '(using default: postgres)'}`);
  console.log('   Attempting to connect to PostgreSQL...\n');
  
  if (!process.env.DB_PASSWORD) {
    console.log('⚠️  Warning: DB_PASSWORD not set in .env file, using default: postgres');
    console.log('   Create a .env file in the backend folder with your PostgreSQL credentials\n');
  }

  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for React frontend
  // Allow all origins in development, specific origin in production
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // In development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      
      // In production, check against allowed origins
      const allowedOrigins = [
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:3000',
      ].filter(Boolean);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Allow by default for now (can be restricted later)
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
    ],
    exposedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // Swagger/OpenAPI configuration
  const config = new DocumentBuilder()
    .setTitle('RTLGDS Cost Estimator API')
    .setDescription('API documentation for RTLGDS Project Cost Estimation Tool. This API provides endpoints for user authentication, system configuration management, cost estimation, and project storage.')
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints - User registration and login')
    .addTag('admin', 'Admin endpoints - Configuration management, view customer projects, and system settings')
    .addTag('estimation', 'Cost estimation endpoints - Calculate project cost and duration')
    .addTag('projects', 'Project management endpoints - Save and retrieve customer project estimates')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3000;
  // Listen on all interfaces (0.0.0.0) to allow external connections from Docker
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend server running on http://0.0.0.0:${port}`);
  console.log(`📚 Swagger documentation available at http://0.0.0.0:${port}/api`);
}

bootstrap();

