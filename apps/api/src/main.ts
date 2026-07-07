// Load .env from any plausible location BEFORE Nest/Prisma initialize, so the
// app works the same whether launched via `npm run dev`, `node dist/main.js`,
// docker, or a sourced shell. (Prisma reads DATABASE_URL from process.env and
// does NOT auto-load .env at runtime — only the Prisma CLI does.)
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
for (const p of [
  resolve(process.cwd(), '.env'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../../../.env'),
]) {
  if (existsSync(p)) loadEnv({ path: p });
}

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);

  // Global URI prefix + versioning  ->  /api/v1/...
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // In development, reflect any localhost origin so the app keeps working even
  // if the web dev server runs on a different port. In production, lock to WEB_ORIGIN.
  const isProd = config.get<string>('env') === 'production';
  const webOrigin = config.get<string>('webOrigin');
  app.enableCors({
    origin: isProd
      ? webOrigin
      : (origin, cb) => cb(null, true),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // OpenAPI / Swagger  ->  /api/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Ojas Trading API')
    .setDescription('Enterprise Commodity Trading Management Platform — REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = config.get<number>('port') ?? 4000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`🚀 Ojas API ready at http://localhost:${port}/api/v1  (docs: /api/docs)`);
}
bootstrap();
