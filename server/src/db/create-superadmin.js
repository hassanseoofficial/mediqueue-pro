/**
 * Create Superadmin User
 * Run with: node create-superadmin.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function createSuperadmin() {
    const client = await pool.connect();
    try {
        console.log('🔐 Creating superadmin user...');

        // Hash password: Super@1234
        const passwordHash = await bcrypt.hash('Super@1234', 10);

        // Insert superadmin (clinic_id is NULL for superadmin)
        await client.query(`
            INSERT INTO users (clinic_id, name, email, password_hash, role)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email)
            DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                role = EXCLUDED.role,
                clinic_id = EXCLUDED.clinic_id;
        `, [null, 'Superadmin User', 'superadmin@mediqueue.com', passwordHash, 'superadmin']);

        console.log('✅ Superadmin created successfully!');
        console.log('');
        console.log('📧 Email:    superadmin@mediqueue.com');
        console.log('🔑 Password: Super@1234');
        console.log('');
        console.log('🎉 You can now login as superadmin!');

    } catch (error) {
        console.error('❌ Error creating superadmin:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

createSuperadmin();
