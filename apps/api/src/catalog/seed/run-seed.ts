import 'reflect-metadata';
import dataSource from '../../database/data-source';
import { seedCatalog } from './seed-catalog';

async function main() {
  await dataSource.initialize();
  try {
    const result = await seedCatalog(dataSource, { skipIfNotEmpty: true });
    if (result.skipped) {
      console.log('Catalog seed skipped: products already exist.');
    } else {
      console.log(`Catalog seed inserted ${result.inserted} products.`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
