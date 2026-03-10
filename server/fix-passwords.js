/**
 * fix-passwords.js — Run once to fix the seed user password hashes.
 * Usage: node fix-passwords.js
 * 
 * This updates admin@demo.com -> Admin@1234
 *                 doctor@demo.com -> Doctor@1234
 */
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function run() {
    try {
        console.log('Connecting to database...');
        await pool.query('SELECT 1');
        console.log('✅ Connected!\n');

        const users = [
            { email: 'admin@demo.com', password: 'Admin@1234' },
            { email: 'doctor@demo.com', password: 'Doctor@1234' },
        ];

        for (const u of users) {
            const hash = await bcrypt.hash(u.password, 10);
            const result = await pool.query(
                'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING email, role',
                [hash, u.email]
            );
            if (result.rows.length) {
                console.log(`✅ Updated ${result.rows[0].email} (${result.rows[0].role}) → password: ${u.password}`);
            } else {
                console.log(`⚠️  User ${u.email} not found — check that seed.sql was run`);
            }
        }

        // Also show all current users for reference
        const allUsers = await pool.query('SELECT email, role, is_active, name FROM users ORDER BY id');
        console.log('\n📋 Current users in DB:');
        console.table(allUsers.rows);

    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error('\nMake sure your .env DATABASE_URL is correct.');
        console.error('Current DATABASE_URL:', process.env.DATABASE_URL);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
