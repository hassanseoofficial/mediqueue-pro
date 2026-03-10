-- MediQueue Pro v3.0 — Full PostgreSQL Schema
-- Run: psql -U postgres -d mediqueue -f 001_initial.sql

-- ─── Extensions ───────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── Clinics (Tenants) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinics (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  address     TEXT,
  phone       VARCHAR(30),
  settings    JSONB DEFAULT '{}',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Doctors ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
  id                    SERIAL PRIMARY KEY,
  clinic_id             INT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  specialization        VARCHAR(100),
  avg_consultation_min  INT DEFAULT 8,
  is_active             BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Doctor Threshold Settings ────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_thresholds (
  id                          SERIAL PRIMARY KEY,
  doctor_id                   INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id                   INT NOT NULL REFERENCES clinics(id),
  session_start               TIME NOT NULL DEFAULT '09:00',
  session_end                 TIME NOT NULL DEFAULT '17:00',
  max_patients                INT NOT NULL DEFAULT 30,
  max_walkin                  INT DEFAULT 20,
  max_online                  INT DEFAULT 15,
  buffer_slots                INT DEFAULT 2,
  grace_period_minutes        INT DEFAULT 5,
  positions_back              INT DEFAULT 2,
  max_penalties_before_noshow INT DEFAULT 3,
  penalty_enabled             BOOLEAN DEFAULT TRUE,
  reset_cron                  VARCHAR(50) DEFAULT '0 0 * * *',
  updated_at                  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id)
);

-- ─── Queue Tokens ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tokens (
  id                  SERIAL PRIMARY KEY,
  clinic_id           INT NOT NULL REFERENCES clinics(id),
  doctor_id           INT NOT NULL REFERENCES doctors(id),
  token_number        VARCHAR(20) NOT NULL,
  patient_name        VARCHAR(200) NOT NULL,
  phone               VARCHAR(30),
  type                VARCHAR(20) DEFAULT 'walkin' CHECK (type IN ('walkin','online')),
  status              VARCHAR(30) NOT NULL DEFAULT 'waiting' CHECK (status IN (
                        'waiting','called','present','in_consultation',
                        'penalized','no_show','completed','on_hold'
                      )),
  position            INT NOT NULL,
  penalty_count       INT DEFAULT 0,
  is_emergency        BOOLEAN DEFAULT FALSE,
  total_sub_patients  INT DEFAULT 1,
  joined_at           TIMESTAMPTZ DEFAULT NOW(),
  called_at           TIMESTAMPTZ,
  present_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ
);

-- ─── Sub-Patients (Companions) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS sub_patients (
  id                      SERIAL PRIMARY KEY,
  token_id                INT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  clinic_id               INT NOT NULL REFERENCES clinics(id),
  name                    VARCHAR(200) NOT NULL,
  relationship            VARCHAR(100),
  age                     INT,
  status                  VARCHAR(30) DEFAULT 'waiting' CHECK (status IN ('waiting','in_consultation','done')),
  consultation_start_at   TIMESTAMPTZ,
  consultation_end_at     TIMESTAMPTZ
);

-- ─── Online Appointments ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id                SERIAL PRIMARY KEY,
  token_id          INT REFERENCES tokens(id),
  clinic_id         INT NOT NULL REFERENCES clinics(id),
  doctor_id         INT NOT NULL REFERENCES doctors(id),
  patient_name      VARCHAR(200) NOT NULL,
  patient_phone     VARCHAR(30),
  scheduled_date    DATE NOT NULL,
  scheduled_time    TIME NOT NULL,
  reminder_sent     BOOLEAN DEFAULT FALSE,
  status            VARCHAR(30) DEFAULT 'booked' CHECK (status IN ('booked','checked_in','completed','cancelled')),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── System Users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  clinic_id       INT REFERENCES clinics(id),
  name            VARCHAR(200) NOT NULL,
  email           VARCHAR(200) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(30) NOT NULL CHECK (role IN ('staff','doctor','admin','superadmin')),
  doctor_id       INT REFERENCES doctors(id),
  totp_secret     TEXT,
  totp_enabled    BOOLEAN DEFAULT FALSE,
  last_login_at   TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Audit / Event Log ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS queue_events (
  id            SERIAL PRIMARY KEY,
  clinic_id     INT NOT NULL REFERENCES clinics(id),
  token_id      INT REFERENCES tokens(id),
  user_id       INT REFERENCES users(id),
  event_type    VARCHAR(50) NOT NULL,
  old_position  INT,
  new_position  INT,
  old_status    VARCHAR(30),
  new_status    VARCHAR(30),
  reason        TEXT,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Doctor Session Stats (for fast report queries) ───────────────
CREATE TABLE IF NOT EXISTS doctor_session_stats (
  id                  SERIAL PRIMARY KEY,
  doctor_id           INT NOT NULL REFERENCES doctors(id),
  clinic_id           INT NOT NULL REFERENCES clinics(id),
  session_date        DATE NOT NULL,
  total_seen          INT DEFAULT 0,
  total_sub_patients  INT DEFAULT 0,
  avg_wait_min        NUMERIC(5,2),
  avg_consult_min     NUMERIC(5,2),
  no_show_count       INT DEFAULT 0,
  emergency_count     INT DEFAULT 0,
  threshold_hit       BOOLEAN DEFAULT FALSE,
  threshold_pct       NUMERIC(5,2),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (doctor_id, session_date)
);

-- ─── Notification Log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications_log (
  id          SERIAL PRIMARY KEY,
  clinic_id   INT NOT NULL REFERENCES clinics(id),
  token_id    INT REFERENCES tokens(id),
  channel     VARCHAR(20) NOT NULL CHECK (channel IN ('sms','email','push')),
  message     TEXT,
  status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tokens_clinic_doctor_date ON tokens(clinic_id, doctor_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(clinic_id, doctor_id, status) WHERE status NOT IN ('completed','no_show');
CREATE INDEX IF NOT EXISTS idx_tokens_position ON tokens(clinic_id, doctor_id, position) WHERE status NOT IN ('completed','no_show');
CREATE INDEX IF NOT EXISTS idx_sub_patients_token ON sub_patients(token_id);
CREATE INDEX IF NOT EXISTS idx_queue_events_token ON queue_events(token_id);
CREATE INDEX IF NOT EXISTS idx_stats_doctor_date ON doctor_session_stats(doctor_id, session_date);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic ON doctors(clinic_id);
