const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
});

/**
 * Execute a query scoped to a clinic.
 * Sets app.current_clinic_id for PostgreSQL RLS policies.
 */
const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

/**
 * Run a transaction with automatic rollback on error.
 * @param {Function} callback - receives the client
 */
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() as now');
    console.log(`✅ PostgreSQL connected at ${res.rows[0].now}`);
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.error('   Set DATABASE_URL in your .env file');
    process.exit(1);
  }
};

module.exports = { pool, query, transaction, testConnection };
