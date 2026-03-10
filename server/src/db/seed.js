/**
 * One-time seed script — run with: node seed.js
 * Inserts demo clinic, doctors, thresholds, and users with correct password hashes.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
    const client = await pool.connect();
    try {
        console.log('🌱 Seeding demo data...');

        // Clinic
        await client.query(`
      INSERT INTO clinics (id, name, slug, address, phone)
      VALUES (1, 'City Medical Center', 'city-medical', '123 Main Street, Karachi', '+92-21-1234567')
      ON CONFLICT (slug) DO NOTHING;
    `);
        console.log('✅ Clinic created');

        // Reset sequence so next ID starts from 2
        await client.query(`SELECT setval('clinics_id_seq', 1, true);`);

        // Doctors
        await client.query(`
      INSERT INTO doctors (id, clinic_id, name, specialization, avg_consultation_min)
      VALUES
        (1, 1, 'Dr. Ahmed Khan', 'General Physician', 8),
        (2, 1, 'Dr. Sara Ali', 'Pediatrician', 10)
      ON CONFLICT DO NOTHING;
    `);
        await client.query(`SELECT setval('doctors_id_seq', 2, true);`);
        console.log('✅ Doctors created');

        // Doctor thresholds
        await client.query(`
      INSERT INTO doctor_thresholds (doctor_id, clinic_id, session_start, session_end, max_patients, max_walkin, max_online, buffer_slots)
      VALUES
        (1, 1, '00:00', '23:59', 30, 20, 15, 2),
        (2, 1, '00:00', '23:59', 25, 18, 12, 2)
      ON CONFLICT (doctor_id) DO NOTHING;
    `);
        console.log('✅ Thresholds created');

        // Users with bcrypt-hashed passwords
        const adminHash = await bcrypt.hash('password', 10);
        const doctorHash = await bcrypt.hash('password', 10);

        await client.query(`
      INSERT INTO users (clinic_id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `, [1, 'Admin User', 'admin@demo.com', adminHash, 'admin']);

        await client.query(`
      INSERT INTO users (clinic_id, name, email, password_hash, role, doctor_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
    `, [1, 'Dr. Ahmed Khan', 'doctor@demo.com', doctorHash, 'doctor', 1]);

        console.log('✅ Users created');
        console.log('\n🎉 Seed complete!');
        console.log('   Admin login:  admin@demo.com  / password');
        console.log('   Doctor login: doctor@demo.com / password');

    } finally {
        client.release();
        await pool.end();
    }
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
