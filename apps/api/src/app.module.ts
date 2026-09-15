import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from './catalog/catalog.module';
import { Product } from './catalog/entities/product.entity';
import { ProductMedia } from './catalog/entities/product-media.entity';
import { buildPostgresSslOptions } from './database/postgres-ssl';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('DB_HOST', 'localhost'),
        port: Number(config.get<string>('DB_PORT', '5432')),
        username: config.get<string>('DB_USER', 'zevooria'),
        password: config.get<string>('DB_PASSWORD', 'zevooria'),
        database: config.get<string>('DB_NAME', 'zevooria'),
        ssl: buildPostgresSslOptions({
          DB_SSL: config.get<string>('DB_SSL'),
          DB_SSL_CA: config.get<string>('DB_SSL_CA'),
        }),
        entities: [Product, ProductMedia],
        synchronize: false,
        logging: config.get<string>('TYPEORM_LOGGING') === 'true',
      }),
    }),
    CatalogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
