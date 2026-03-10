# MediQueue Pro v3.0

**Real-time Medical Queue & Appointment Ticketing System**  
Stack: Node.js · React · Socket.IO · PostgreSQL · Redis (optional) · TailwindCSS

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL running locally

### 1. Clone & Install

```bash
cd "Doctor Ticketing System"
npm install            # root concurrently
cd server && npm install
cd ../client && npm install
```

### 2. Configure Environment

```bash
copy .env.example server/.env
```

Edit `server/.env`:
- Set `DATABASE_URL` to your local PostgreSQL connection string  
- `REDIS_URL` is optional — app uses in-memory fallback if not set  
- `JWT_SECRET` — set any long random string  

### 3. Setup Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE mediqueue;"

# Run migrations
psql -U postgres -d mediqueue -f server/src/db/migrations/001_initial.sql

# Load demo data
psql -U postgres -d mediqueue -f server/src/db/seed.sql
```

### 4. Run Both Servers

```bash
# From project root:
npm run dev
```

This starts:
- **Backend** on http://localhost:3001
- **Frontend** on http://localhost:5173

---

## URLs

| URL | Description |
|-----|-------------|
| `http://localhost:5173/queue` | Patient queue join page |
| `http://localhost:5173/token/:id` | Patient live status page |
| `http://localhost:5173/display` | Waiting room TV display board |
| `http://localhost:5173/login` | Staff/Doctor login |
| `http://localhost:5173/admin` | Admin game-style dashboard |
| `http://localhost:5173/doctor` | Doctor reports portal |
| `http://localhost:3001/health` | API health check |

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | password |
| Doctor | doctor@demo.com | password |

---

## Architecture

```
client/   — React + Vite + TailwindCSS (deploy to Vercel)
server/   — Node.js + Express + Socket.IO (deploy to Railway)
```

Database: PostgreSQL with `clinic_id` row-level isolation  
Real-time: Socket.IO with Redis pub/sub adapter  
Queue Jobs: BullMQ with setTimeout fallback for local dev  
SMS: Twilio (console.log fallback when not configured)  

---

## Key Features

- **Game-style admin dashboard** — 8 large action buttons, hold-to-confirm for destructive actions
- **Real-time updates** — Socket.IO queue changes in <100ms
- **Atomic threshold check** — Redis INCR prevents overbooking under any concurrency
- **Multi-patient tickets** — one token for a family, each member tracked individually
- **Penalty system** — BullMQ delayed jobs auto-penalize absent patients
- **Emergency override** — inserts at queue position 1, broadcasts to all screens
- **Display board** — waiting room TV screen with audio announcements
- **Doctor analytics** — daily/weekly/monthly Recharts reports

See `functionaldocs.md` for complete specification.
