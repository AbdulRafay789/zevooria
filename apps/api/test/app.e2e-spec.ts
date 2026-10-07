import { NestFactory } from '@nestjs/core';
import { AppModule } from './../src/app.module';
import request from 'supertest';
import { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';

/**
 * Smoke tests against a real Postgres (set E2E_DB=true).
 * Without that flag, suites are skipped so CI/unit runs stay green offline.
 */
describe('API smoke (e2e)', () => {
  let app: INestApplication | undefined;
  let server: Server | undefined;

  beforeAll(async () => {
    if (process.env.E2E_DB !== 'true') {
      return;
    }
    app = await NestFactory.create(AppModule);
    app.setGlobalPrefix('api');
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/health returns 200', async () => {
    if (!server) {
      return;
    }
    await request(server).get('/api/health').expect(200);
  });

  it('GET responses include X-RateLimit-* headers', async () => {
    if (!server) {
      return;
    }
    // Health is exempt — hit a public catalog list instead.
    const res = await request(server).get('/api/products');
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-ratelimit-remaining']).toBeDefined();
    expect(res.headers['x-ratelimit-reset']).toMatch(/^\d+$/);
    expect(Number(res.headers['x-ratelimit-limit'])).toBeGreaterThanOrEqual(
      100,
    );
  });

  it('POST /api/auth/login rejects invalid body without 500', async () => {
    if (!server) {
      return;
    }
    const res = await request(server)
      .post('/api/auth/login')
      .send({})
      .expect((r) => {
        expect([400, 401, 429]).toContain(r.status);
      });
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
  });
});
