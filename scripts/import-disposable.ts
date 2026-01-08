import { readFileSync } from 'fs';
import { createConnection } from 'typeorm';
import { DisposableDomain } from '../src/disposable-email/disposable-domain.entity';
import Redis from 'ioredis';

async function importDisposableDomains() {
  console.log('🚀 Starting import...');

  // 1. Lire le fichier
  const filePath = './data/disposable-domains.txt';
  console.log(`📖 Reading file: ${filePath}`);
  
  const content = readFileSync(filePath, 'utf-8');
  const domains = content
    .split('\n')
    .map(d => d.trim().toLowerCase())
    .filter(d => d && !d.startsWith('#')); // Ignorer lignes vides et commentaires

  console.log(`✅ Found ${domains.length} domains`);

  // 2. Connexion DB
  console.log('🔌 Connecting to database...');
  const connection = await createConnection({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'yeswecheck_user',
    password: process.env.DB_PASSWORD || 'SecurePassword123!',
    database: 'yeswecheck',
    entities: [DisposableDomain],
  });

  const repo = connection.getRepository(DisposableDomain);

  // 3. Connexion Redis
  console.log('🔌 Connecting to Redis...');
  const redis = new Redis({ host: 'localhost', port: 6379, db: 0 });

  // 4. Import par batch de 1000
  let imported = 0;
  const batchSize = 1000;
  const redisKey = 'disposable:domains';

  for (let i = 0; i < domains.length; i += batchSize) {
    const batch = domains.slice(i, i + batchSize);
    const entities = batch.map(domain => ({
      domain,
      isCustom: false,
      isActive: true,
    }));

    // Insert en DB
    await repo
      .createQueryBuilder()
      .insert()
      .into(DisposableDomain)
      .values(entities)
      .orIgnore()
      .execute();

    // Insert en Redis
    await redis.sadd(redisKey, ...batch);

    imported += batch.length;
    const progress = ((imported / domains.length) * 100).toFixed(1);
    console.log(`📦 Progress: ${imported}/${domains.length} (${progress}%)`);
  }

  // 5. Cleanup
  await connection.close();
  await redis.quit();

  console.log(`\n✅ Import complete!`);
  console.log(`💾 Database: ${imported} rows`);
  console.log(`⚡ Redis: ${imported} keys in Set`);
}

importDisposableDomains().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
