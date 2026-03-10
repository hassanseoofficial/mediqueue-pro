-- MediQueue Pro — Demo Seed Data
-- Run after 001_initial.sql
-- Default admin password: Admin@1234
-- Default doctor password: Doctor@1234

-- ─── Clinic ────────────────────────────────────────────────────────
INSERT INTO clinics (name, slug, address, phone) VALUES
  ('City Medical Center', 'city-medical', '123 Main Street, Karachi', '+92-21-1234567')
ON CONFLICT (slug) DO NOTHING;

-- ─── Doctors ───────────────────────────────────────────────────────
INSERT INTO doctors (clinic_id, name, specialization, avg_consultation_min) VALUES
  (1, 'Dr. Ahmed Khan', 'General Physician', 8),
  (1, 'Dr. Sara Ali', 'Pediatrician', 10)
ON CONFLICT DO NOTHING;

-- ─── Doctor Thresholds ─────────────────────────────────────────────
INSERT INTO doctor_thresholds (doctor_id, clinic_id, session_start, session_end, max_patients, max_walkin, max_online, buffer_slots) VALUES
  (1, 1, '09:00', '14:00', 30, 20, 15, 2),
  (2, 1, '10:00', '15:00', 25, 18, 12, 2)
ON CONFLICT (doctor_id) DO NOTHING;

-- ─── Users ─────────────────────────────────────────────────────────
-- Admin password: Admin@1234
INSERT INTO users (clinic_id, name, email, password_hash, role) VALUES
  (1, 'Admin User', 'admin@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Doctor password: Doctor@1234
INSERT INTO users (clinic_id, name, email, password_hash, role, doctor_id) VALUES
  (1, 'Dr. Ahmed Khan', 'doctor@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'doctor', 1)
ON CONFLICT (email) DO NOTHING;
