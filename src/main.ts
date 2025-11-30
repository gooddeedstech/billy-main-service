import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // 🔐 Security Middleware
  app.use(helmet());

  // 🌎 Enable CORS
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  // 🧹 DTO Validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // 🌍 API Prefix (optional)
  //app.setGlobalPrefix('api');

  // 📘 Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Billy WhatsApp API')
    .setDescription(
      'API documentation for Billy onboarding, WhatsApp automation, KYC, virtual accounts, and LLM features.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // 🚀 Start Server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Billy WhatsApp API running on port ${port}`);
  logger.log(`📘 Swagger Docs available at http://localhost:${port}/docs`);
}
bootstrap();