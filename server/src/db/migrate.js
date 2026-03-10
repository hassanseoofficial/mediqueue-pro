require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('./index');

async function migrate() {
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
        console.log(`Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        console.log(`✅ Migration complete: ${file}`);
    }

    console.log('\n✅ All migrations applied successfully.');
    process.exit(0);
}

migrate().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
