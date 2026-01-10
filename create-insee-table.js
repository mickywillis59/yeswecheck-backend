const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'yeswecheck_user',
  password: 'SecurePassword123!',
  database: 'yeswecheck',
});

async function createTable() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected! ');

    const sql = `
      CREATE TABLE IF NOT EXISTS insee_firstnames (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        firstname VARCHAR(100) UNIQUE NOT NULL,
        male_count INTEGER DEFAULT 0,
        female_count INTEGER DEFAULT 0,
        total_count INTEGER DEFAULT 0,
        gender_ratio FLOAT DEFAULT 0,
        dominant_gender CHAR(1),
        birth_years JSONB,
        estimated_age INTEGER,
        age_p25 INTEGER,
        age_p50 INTEGER,
        age_p75 INTEGER,
        peak_decade VARCHAR(10),
        source VARCHAR(50) DEFAULT 'insee',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_firstname ON insee_firstnames(firstname);
    `;

    console.log('📝 Creating table insee_firstnames...');
    await client.query(sql);
    console.log('✅ Table created successfully!');

    // Vérifier
    const result = await client.query(`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = 'insee_firstnames'
    `);
    
    console.log(`\n✅ Table exists: ${result.rows[0]. count === '1' ? 'YES' : 'NO'}`);

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createTable();
