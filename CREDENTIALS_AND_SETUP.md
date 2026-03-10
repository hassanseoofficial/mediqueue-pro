# MediQueue Pro - Credentials & Setup Reference

## 🔐 DEFAULT USER ACCOUNTS

### Superadmin (SaaS Owner) ✅
```
Email: superadmin@mediqueue.com
Password: Super@1234
Role: superadmin
Clinic Access: ALL clinics
```

**Capabilities:**
- Register new clinics
- Manage all clinics from superadmin dashboard
- View cross-clinic analytics
- Create admins for each clinic

---

### Clinic Admin (Clinic Owner) ✅
```
Email: admin@demo.com
Password: password
Role: admin
Clinic: City Medical Center (clinic_id: 1)
```

**Capabilities:**
- Manage doctors in their clinic
- Configure doctor thresholds (session hours, capacity)
- Manage queue operations (call, hold, complete)
- Add staff members
- View clinic reports

---

### Doctor ✅
```
Email: doctor@demo.com
Password: password
Role: doctor
Doctor ID: 1 (Dr. Ahmed Khan)
Clinic: City Medical Center
```

**Capabilities:**
- View own queue dashboard
- View daily/weekly/monthly reports
- Update own threshold settings
- Cannot manage other doctors

---

### Staff (Queue Operator) ❌ NOT CREATED
```
Note: No staff user exists by default
You need to create one via Admin panel
```

**Expected Capabilities:**
- Call next patient
- Mark present/complete
- Apply penalties
- Add emergency patients
- Cannot add doctors or change settings

---

## 🏥 HOW CLINICS WORK

### Clinic Registration Flow

```
Step 1: Superadmin creates clinic
POST /api/admin/clinics
{
  "name": "City General Hospital",
  "slug": "city-general",
  "address": "123 Main St",
  "phone": "+1234567890"
}

Step 2: Clinic gets auto-assigned clinic_id = 2

Step 3: Superadmin adds Admin for that clinic
POST /api/admin/users
{
  "clinic_id": 2,
  "name": "Hospital Admin",
  "email": "admin@citygeneral.com",
  "password": "SecurePass123",
  "role": "admin"
}

Step 4: Clinic Admin logs in and adds doctors
POST /api/admin/doctors
{
  "name": "Dr. Sarah Smith",
  "specialization": "Cardiology",
  "avg_consultation_min": 15
}

Step 5: Configure doctor thresholds
PATCH /api/admin/doctors/:doctorId/threshold
{
  "session_start": "09:00",
  "session_end": "17:00",
  "max_patients": 40,
  "max_walkin": 25,
  "max_online": 15,
  "grace_period_minutes": 5
}

Step 6: Clinic is LIVE!
Patients can now join queue at:
/queue?clinic=2&doctor=5
```

---

## 🔄 PATIENT FLOW (PER DOCTOR)

### Example: Dr. Smith's Queue (doctor_id: 3)

```
10:00 AM - Patient A joins
   Token: B-001
   Status: waiting
   Position: 1

10:05 AM - Patient B joins
   Token: B-002
   Status: waiting
   Position: 2

10:10 AM - Staff calls Patient A
   Token: B-001
   Status: waiting → called
   Grace period starts (5 minutes)

10:12 AM - Patient A arrives at desk
   Token: B-001
   Status: called → present
   Penalty job cancelled

10:15 AM - Patient A enters consultation
   Token: B-001
   Status: present → in_consultation

10:30 AM - Consultation complete
   Token: B-001
   Status: in_consultation → completed

10:31 AM - Staff calls Patient B
   Token: B-002
   Status: waiting → called
```

**Meanwhile, Dr. Jones (doctor_id: 4) has completely separate queue:**
```
10:00 AM - Patient C joins Dr. Jones
   Token: A-001 (different series)
   Status: waiting
   Position: 1

This is INDEPENDENT of Dr. Smith's queue!
```

---

## 📊 DOCTOR THRESHOLD EXAMPLES

### Conservative Doctor (Low Volume)
```
Dr. Wilson - General Practitioner
session_start: 09:00
session_end: 13:00
max_patients: 15
max_walkin: 10
max_online: 8
buffer_slots: 2
grace_period_minutes: 10
positions_back: 3
max_penalties_before_noshow: 2
```

### High-Volume Doctor (Busy Specialist)
```
Dr. Chen - Dermatology
session_start: 08:00
session_end: 18:00
max_patients: 60
max_walkin: 40
max_online: 25
buffer_slots: 5
grace_period_minutes: 3
positions_back: 1
max_penalties_before_noshow: 3
```

---

## 🎮 ADMIN DASHBOARD ACTIONS

### Call Next Patient
```
POST /api/admin/queue/call-next
{ "doctor_id": 3 }

Result:
- Next waiting patient → called
- WebSocket broadcast to:
  • Admin queue viewer
  • Display board (TV screen)
  • Patient's phone (real-time status update)
- SMS sent (optional)
- Grace period timer starts
```

### Hold Patient (e.g., went to pharmacy)
```
PATCH /api/admin/token/5/hold

Result:
- Status: in_consultation → on_hold
- Patient removed from active queue
- Can be recalled later
```

### Recall Held Patient
```
PATCH /api/admin/token/5/recall

Result:
- Status: on_hold → called
- Re-enters queue
- Grace period timer restarts
```

### Emergency Insert (Urgent Case)
```
POST /api/admin/token/emergency
{
  "doctor_id": 3,
  "patient_name": "John Urgent",
  "phone": "+1234567890",
  "reason": "Chest pain - cardiac emergency"
}

Result:
- All waiting patients shift back (position += 1)
- Emergency patient inserted at position 0
- Status: waiting → called (immediately)
- Red highlight on display board
- Audit log entry created
```

### Apply Penalty (Patient didn't respond to call)
```
POST /api/admin/token/7/penalty

Result (1st penalty):
- Position: 3 → 5 (moved back 2 positions)
- penalty_count: 0 → 1
- Status: called → penalized
- SMS: "You missed your call. New position: 5"

Result (3rd penalty - max reached):
- Status: penalized → no_show
- Removed from queue
- SMS: "Appointment marked no-show"
- Cannot rejoin today
```

---

## 🔒 ROLE-BASED ACCESS CONTROL

### What Each Role Can Do:

| Action | Patient | Staff | Doctor | Admin | Superadmin |
|--------|---------|-------|--------|-------|------------|
| Join queue | ✅ | ✅ | ❌ | ✅ | ✅ |
| View own token status | ✅ | ✅ | ✅ | ✅ | ✅ |
| Call next patient | ❌ | ✅ | ❌ | ✅ | ✅ |
| Mark present/complete | ❌ | ✅ | ❌ | ✅ | ✅ |
| Apply penalty/hold | ❌ | ✅ | ❌ | ✅ | ✅ |
| Add/edit doctors | ❌ | ❌ | ❌ | ✅ | ✅ |
| Configure thresholds | ❌ | ❌ | Own only | ✅ | ✅ |
| View reports | ❌ | ❌ | Own only | ✅ | ✅ |
| Register clinics | ❌ | ❌ | ❌ | ❌ | ✅ |
| Access all clinics | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🌐 MULTI-TENANT ISOLATION

### How Data Is Isolated:

```sql
-- Every query scoped to clinic
SELECT * FROM tokens
WHERE clinic_id = $1
  AND doctor_id = $2
  AND joined_at::DATE = CURRENT_DATE;

-- User can only access their own clinic
-- (except superadmin who can scope to any clinic)
WHERE clinic_id = req.user.clinic_id

-- WebSocket rooms isolated by clinic
Room: clinic:1:doctor:5:queue
  vs
Room: clinic:2:doctor:12:queue

-- Redis keys namespaced by clinic
clinic:1:doctor:5:threshold_count
  vs
clinic:2:doctor:12:threshold_count
```

**Security Layers:**
1. JWT payload includes `clinic_id` (cannot be spoofed)
2. Middleware enforces `WHERE clinic_id = req.user.clinic_id`
3. WebSocket rooms include clinic_id in name
4. Redis keys namespaced by clinic_id

**Superadmin Override:**
- Can query any clinic via `?clinic_id=X` query param
- Used for multi-clinic dashboard

---

## 📱 PATIENT EXPERIENCE

### Joining Queue (Public - No Login)

```
Step 1: Visit /queue
Step 2: Select clinic from dropdown
Step 3: Select doctor from dropdown
Step 4: Fill form:
   - Name
   - Phone
   - Type (walk-in or appointment)
   - Add companions (optional, up to 4)

Step 5: Click "Get Token"

Result:
   Token: B-012
   Position: 5
   Estimated wait: 45 minutes
   Status: waiting

   QR code displayed (scan to track on phone)
```

### Real-Time Status Updates

```
Patient scans QR → redirected to /token/B-012

Live updates via WebSocket:
• Position changes (5 → 4 → 3...)
• Status changes (waiting → called → present)
• Estimated wait time updates
• Penalty notifications (if missed call)

Audio announcements:
• "Token B-012, please proceed to Doctor's desk"
• Plays sound + vibration on mobile
```

---

## 🖥️ DISPLAY BOARD (Waiting Room TV)

### Setup

```
Open on TV browser: /display/:clinicId/:doctorId

Example: /display/1/3
Shows Dr. Smith's queue on TV in real-time
```

### What It Shows:

```
┌─────────────────────────────────────────┐
│     DR. SMITH - CARDIOLOGY              │
│                                         │
│  NOW SERVING:  B-012                    │
│                                         │
│  WAITING QUEUE:                         │
│  B-013  Position 1   (5 mins)          │
│  B-014  Position 2   (10 mins)         │
│  B-015  Position 3   (15 mins)         │
│  E-001  EMERGENCY    (called)          │
│                                         │
│  Total Today: 28 / 40 capacity         │
└─────────────────────────────────────────┘
```

**Updates:**
- Real-time via WebSocket
- No refresh needed
- Red highlight for emergencies
- Green highlight for currently called token
- Smooth animations

---

## 📈 DOCTOR DASHBOARD & REPORTS

### Daily Report
```
GET /api/doctor/reports/daily/2026-03-09

Response:
{
  "date": "2026-03-09",
  "total_seen": 32,
  "total_sub_patients": 8,
  "no_show_count": 3,
  "emergency_count": 2,
  "avg_wait_min": 12.5,
  "avg_consult_min": 14.2,
  "threshold_hit": false,
  "threshold_pct": 80.0,
  "peak_hour": "10:00-11:00",
  "busiest_hour_count": 8
}
```

### Weekly Report
```
GET /api/doctor/reports/weekly

Returns last 7 days aggregate stats
```

### Monthly Report
```
GET /api/doctor/reports/monthly/2026/3

Returns full month breakdown by day
```

---

## 🔧 ENVIRONMENT SETUP

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/mediqueue
REDIS_URL=redis://user:pass@host:6379

# Auth
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-refresh-token-secret-here

# Twilio (SMS)
TWILIO_ACCOUNT_SID=ACxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Frontend URL
FRONTEND_URL=http://localhost:5173

# Server
PORT=3000
NODE_ENV=development
```

### Database Migrations

```bash
# Run all migrations
npm run migrate

# Rollback last migration
npm run migrate:rollback

# Seed demo data
npm run seed
```

---

## 🎯 TESTING WORKFLOW

### Test Scenario: Multi-Doctor Queue

```
Clinic: Demo Medical Center (clinic_id: 1)

Doctor A: Dr. Smith (doctor_id: 3) - Cardiology
Doctor B: Dr. Jones (doctor_id: 4) - Orthopedics

10:00 AM - Patient 1 joins Dr. Smith → Token A-001
10:05 AM - Patient 2 joins Dr. Jones → Token B-001
10:10 AM - Patient 3 joins Dr. Smith → Token A-002

Admin Dashboard:
- Switch to Dr. Smith's queue → see A-001, A-002
- Switch to Dr. Jones's queue → see B-001

Call next for Dr. Smith:
- A-001 status → called
- A-002 still waiting

Call next for Dr. Jones:
- B-001 status → called
- A-001 unaffected (different queue!)

Mark present for Dr. Smith (A-001):
- A-001 → present
- B-001 still called (different doctor!)
```

---

## 🚨 COMMON PITFALLS & SOLUTIONS

### Issue: "Threshold reached" error
**Cause:** Doctor has max_patients configured, and limit reached for today

**Solution:**
1. Admin can increase threshold temporarily:
   ```
   PATCH /api/admin/doctors/:doctorId/threshold
   { "max_patients": 50 }  // increase from 40
   ```
2. Or add patient as emergency (bypasses threshold)

---

### Issue: Patient marked "no_show" accidentally
**Cause:** Staff clicked penalty 3 times

**Solution:**
1. Check audit log:
   ```
   SELECT * FROM queue_events
   WHERE token_id = X
   ORDER BY created_at DESC;
   ```
2. Manually reset token status in database (if justified):
   ```sql
   UPDATE tokens
   SET status = 'called', penalty_count = 0
   WHERE id = X;
   ```

---

### Issue: WebSocket not updating
**Cause:** Patient not in correct room

**Debug:**
1. Check browser console for Socket.IO connection
2. Verify room join:
   ```javascript
   socket.emit('join:patient', { tokenId: 'B-012' });
   ```
3. Check backend logs for room membership

---

## 📞 SUPPORT & DOCS

- API Documentation: `/docs` (Swagger - to be implemented)
- Admin Guide: This file
- GitHub: https://github.com/your-org/mediqueue-pro
- Support Email: support@mediqueue.com

---

## 🎓 KEY CONCEPTS SUMMARY

1. **Multi-Tenancy**: Each clinic is isolated, shares same codebase
2. **Per-Doctor Queues**: Each doctor has independent queue, threshold, settings
3. **Real-Time**: WebSocket updates < 100ms for all clients
4. **Atomic Operations**: Redis prevents race conditions on threshold checks
5. **Penalty System**: Auto-penalizes patients who don't respond to calls
6. **Emergency Override**: Bypass threshold and insert at position 0
7. **Audit Logging**: Every action logged to `queue_events` table
8. **Role-Based Access**: 4 tiers (patient, staff, doctor, admin, superadmin)

---

**Last Updated:** 2026-03-09
**Version:** 3.0
**Author:** MediQueue Pro Team
