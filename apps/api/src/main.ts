import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { validateEnvironment } from './config/environment.js';
import { StructuredLogger } from './logging/structured-logger.js';
import { project } from './generated/project.js';

async function bootstrap(): Promise<void> {
  validateEnvironment();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(StructuredLogger));
  app.flushLogs();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: [
      process.env.ADMIN_ORIGIN ?? 'http://localhost:3000',
      process.env.WEB_ORIGIN ?? 'http://localhost:3002',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3002',
    ],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const openApi = new DocumentBuilder()
    .setTitle(`${project.displayName} API`)
    .setDescription(project.description)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: '短期 Access Token',
    })
    .addCookieAuth(
      'template_refresh',
      { type: 'apiKey', in: 'cookie', description: 'HttpOnly Refresh Token，仅由浏览器发送' },
      'template_refresh',
    )
    .addCookieAuth(
      'customer_refresh',
      { type: 'apiKey', in: 'cookie', description: '用户端 HttpOnly Refresh Token' },
      'customer_refresh',
    )
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, openApi));

  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port);
}

void bootstrap();
