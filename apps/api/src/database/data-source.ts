import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { Product } from '../catalog/entities/product.entity';
import { ProductMedia } from '../catalog/entities/product-media.entity';
import { InitialCatalog1757961600000 } from './migrations/1757961600000-InitialCatalog';
import { buildPostgresSslOptions } from './postgres-ssl';

// Load repo-root .env when commands run from apps/api
loadEnv({ path: '../../.env' });
loadEnv();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER ?? 'zevooria',
  password: process.env.DB_PASSWORD ?? 'zevooria',
  database: process.env.DB_NAME ?? 'zevooria',
  ssl: buildPostgresSslOptions(process.env),
  entities: [Product, ProductMedia],
  migrations: [InitialCatalog1757961600000],
  synchronize: false,
  logging: process.env.TYPEORM_LOGGING === 'true',
});
