import { NestFactory } from '@nestjs/core';
import { AppModule } from './../src/app.module';
import request from 'supertest';
import { Server } from 'node:http';

describe('Health (e2e)', () => {
  let server: Server;

  beforeAll(async () => {
    // Skip when DB is unavailable — unit tests cover domain logic.
    if (process.env.E2E_DB !== 'true') {
      return;
    }
    const app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/health', async () => {
    if (process.env.E2E_DB !== 'true') {
      return;
    }
    await request(server).get('/api/health').expect(200);
  });
});
