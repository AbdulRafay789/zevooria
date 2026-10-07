import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

function corsOriginsFromEnv(): boolean | string[] {
  const configured = [process.env.WEB_PUBLIC_URL, process.env.ADMIN_PUBLIC_URL]
    .map((value) => value?.trim().replace(/\/+$/, ''))
    .filter((value): value is string => Boolean(value));

  if (configured.length === 0) {
    // Local/dev fallback when public URLs are unset.
    if (process.env.NODE_ENV !== 'production') {
      return [
        'http://localhost:3000',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3002',
      ];
    }
    return false;
  }
  return configured;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      // API is JSON; CSP is less relevant than for HTML documents.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableCors({
    origin: corsOriginsFromEnv(),
    credentials: true,
  });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
