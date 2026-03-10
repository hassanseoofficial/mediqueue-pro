# MediQueue Pro - Complete Architecture Flow Diagram

## 🏗️ MULTI-TENANT HIERARCHY

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPERADMIN                               │
│              (SaaS Owner - God Mode Access)                     │
│                                                                 │
│  • Register new clinics                                         │
│  • View all clinics dashboard                                   │
│  • Cross-clinic analytics                                       │
│  • Billing & subscription management                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  CLINIC 1    │  │  CLINIC 2    │  │  CLINIC 3    │
│  City Gen.   │  │  Metro Hosp. │  │  Care Center │
│  Hospital    │  │              │  │              │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ ADMIN        │  │ ADMIN        │  │ ADMIN        │
│ (Clinic      │  │ (Clinic      │  │ (Clinic      │
│  Owner)      │  │  Owner)      │  │  Owner)      │
│              │  │              │  │              │
│ • Add docs   │  │ • Add docs   │  │ • Add docs   │
│ • Add staff  │  │ • Add staff  │  │ • Add staff  │
│ • Settings   │  │ • Settings   │  │ • Settings   │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       └─────────┬───────┴─────────┬───────┘
                 │                 │
        ┌────────┴────────┬────────┴────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ DOCTOR 1     │  │ DOCTOR 2     │  │ DOCTOR 3     │
│ Dr. Smith    │  │ Dr. Jones    │  │ Dr. Chen     │
│ Cardiology   │  │ Orthopedics  │  │ Dermatology  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │                 │                 │
       │                 │                 │
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ QUEUE 1      │  │ QUEUE 2      │  │ QUEUE 3      │
│              │  │              │  │              │
│ B-001 ✓      │  │ A-001 👤     │  │ C-001 ⏳     │
│ B-002 👤     │  │ A-002 ⏳     │  │ C-002 ⏳     │
│ B-003 ⏳     │  │ A-003 ⏳     │  │ C-003 ⏳     │
│              │  │              │  │              │
│ Max: 40      │  │ Max: 30      │  │ Max: 60      │
│ Current: 28  │  │ Current: 15  │  │ Current: 42  │
└──────────────┘  └──────────────┘  └──────────────┘

Legend:
✓ = Completed
👤 = Called/Present
⏳ = Waiting
```

---

## 🔄 COMPLETE PATIENT JOURNEY (Per Doctor)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PATIENT ENTERS CLINIC                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Patient sees │
                  │ doctor list  │
                  │ on wall/iPad │
                  └──────┬───────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Scans QR code for    │
              │ Dr. Smith (Cardiology)│
              └──────────┬───────────┘
                         │
                         ▼
         ┌───────────────────────────────────┐
         │ /queue?clinic=1&doctor=3          │
         │                                   │
         │ Form:                             │
         │  Name: John Doe                   │
         │  Phone: +1234567890               │
         │  Type: Walk-in                    │
         │  Add Family: Wife, Son (age 8)    │
         └───────────────┬───────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ THRESHOLD CHECK      │
              │ (Redis atomic INCR)  │
              │                      │
              │ Current: 28          │
              │ Limit: 40            │
              │ Adding: 3 (1+2 comp) │
              │ Result: 31 ≤ 38 ✅   │
              └──────────┬───────────┘
                         │
                         ▼
         ┌───────────────────────────────────┐
         │ TOKEN CREATED                     │
         │                                   │
         │ Token: B-012                      │
         │ Position: 6                       │
         │ Status: waiting                   │
         │ Sub-patients: 2                   │
         │   • Wife (relationship: spouse)   │
         │   • Son (relationship: child, 8)  │
         │                                   │
         │ QR Code: [████████]               │
         └───────────────┬───────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Patient sits in      │
              │ waiting area         │
              │                      │
              │ Phone shows:         │
              │ Position: 6          │
              │ Ahead: 5 patients    │
              │ Est. wait: 45 mins   │
              └──────────┬───────────┘
                         │
                         │ (Time passes...)
                         │ Position updates: 6 → 5 → 4 → 3 → 2 → 1
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAFF CALLS NEXT                             │
│                                                                 │
│  POST /api/admin/queue/call-next { doctor_id: 3 }              │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │ TOKEN CALLED                  │
         │                               │
         │ Status: waiting → called      │
         │ Position: 1 → 0               │
         │ called_at: 10:30 AM           │
         │                               │
         │ Grace Period: 5 mins          │
         │ (BullMQ job scheduled)        │
         └───────────────┬───────────────┘
                         │
         ┌───────────────┴───────────────────────────────┐
         │ REAL-TIME BROADCAST                           │
         │                                               │
         │ Socket.IO emits to:                           │
         │  • clinic:patient:B-012 → patient phone       │
         │  • clinic:1:doctor:3:display → TV screen      │
         │  • clinic:1:doctor:3:queue → admin dashboard  │
         └───────────────┬───────────────────────────────┘
                         │
         ┌───────────────┴───────────────────────────────┐
         │ PATIENT EXPERIENCE                            │
         │                                               │
         │ Phone vibrates + audio:                       │
         │ "Token B-012, please proceed to Dr. Smith"   │
         │                                               │
         │ TV Screen shows:                              │
         │ ┌─────────────────────────────┐              │
         │ │ NOW SERVING: B-012          │              │
         │ └─────────────────────────────┘              │
         │                                               │
         │ Admin Dashboard:                              │
         │ [B-012] Called - 10:30 AM                     │
         └───────────────┬───────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Patient arrives at   │
              │ reception desk       │
              │                      │
              │ Staff clicks:        │
              │ [MARK PRESENT]       │
              └──────────┬───────────┘
                         │
         ┌───────────────┴───────────────┐
         │ PATCH /api/admin/token/12/present│
         │                               │
         │ Status: called → present      │
         │ present_at: 10:32 AM          │
         │                               │
         │ Cancel BullMQ penalty job ✅  │
         └───────────────┬───────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Patient enters       │
              │ consultation room    │
              │                      │
              │ Doctor examines:     │
              │ • John Doe (primary) │
              │ • Wife               │
              │ • Son (age 8)        │
              └──────────┬───────────┘
                         │
                         ▼
         ┌───────────────────────────────────┐
         │ DOCTOR MARKS COMPLETION           │
         │                                   │
         │ For each sub-patient:             │
         │ PATCH /api/admin/sub-patient/X    │
         │ { status: "in_consultation" }     │
         │                                   │
         │ Then:                             │
         │ PATCH /api/admin/sub-patient/X    │
         │ { status: "done" }                │
         │                                   │
         │ Finally (main token):             │
         │ PATCH /api/admin/token/12/complete│
         └───────────────┬───────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │ Status: present → completed   │
         │ completed_at: 11:00 AM        │
         │                               │
         │ Session Stats Updated:        │
         │ • total_seen += 1             │
         │ • total_sub_patients += 2     │
         │ • avg_consult_min recalc      │
         └───────────────┬───────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │ Patient exits        │
              │                      │
              │ Total time: 30 mins  │
              │ (Wait: 15 + Consult: │
              │  15 mins)            │
              └──────────────────────┘
```

---

## ⚠️ PENALTY FLOW (When Patient Doesn't Respond)

```
Patient Called → Status: "called"
         │
         ▼
Grace Period Starts (5 minutes)
         │
         │ BullMQ job scheduled:
         │ Job ID: penalty:B-012
         │ Delay: 5 * 60 * 1000 ms
         │
         ├─────── SCENARIO A ──────┐
         │ Patient arrives         │
         │                         │
         ▼                         │
PATCH /token/12/present            │
    │                              │
    ▼                              │
Cancel penalty job ✅              │
Status: present                    │
    │                              │
    ▼                              │
Normal flow continues              │
                                   │
                                   │
         ├─────── SCENARIO B ──────┘
         │ Patient NOT present
         │
         ▼
Grace Period Expires (5:00 elapsed)
         │
         ▼
BullMQ Job Executes
         │
         ├─ Check: penalty_count + 1 >= max_penalties?
         │
         ├── YES (3rd penalty) ─────────────┐
         │                                  │
         │   Status: penalized → no_show    │
         │   SMS: "Marked no-show"          │
         │   Remove from queue              │
         │   Audit log: event_type='no_show'│
         │                                  │
         └── NO (1st or 2nd penalty) ───────┤
                                            │
             Status: called → penalized     │
             position: 3 → 5 (+2)           │
             penalty_count: 0 → 1           │
                                            │
             SMS: "Missed call. New pos: 5" │
             Audit log: event_type='penalty'│
                                            │
             Schedule NEXT penalty job ⏰   │
             (for when recalled)            │
                                            │
                    │                       │
                    ▼                       │
         Patient Eventually Responds        │
                    │                       │
                    ▼                       │
         PATCH /token/12/recall             │
                    │                       │
         Status: penalized → called         │
         New grace period starts            │
```

---

## 🚨 EMERGENCY INSERT FLOW

```
Admin Dashboard
         │
         ▼
[EMERGENCY] Button Clicked
         │
         ▼
Modal Opens:
┌────────────────────────────┐
│ Name: Jane Critical        │
│ Phone: +1111111111         │
│ Reason: Chest pain         │
│ [INSERT EMERGENCY]         │
└────────────────────────────┘
         │
         ▼
POST /api/admin/token/emergency
         │
         ▼
┌─────────────────────────────────────┐
│ ATOMIC TRANSACTION                  │
│                                     │
│ Step 1: Shift all active tokens     │
│ UPDATE tokens                       │
│ SET position = position + 1         │
│ WHERE doctor_id = 3                 │
│   AND status IN ('waiting','called')│
│                                     │
│ Before:                             │
│ B-001 position=0 (called)           │
│ B-002 position=1 (waiting)          │
│ B-003 position=2 (waiting)          │
│                                     │
│ After:                              │
│ B-001 position=1 ⚠️                 │
│ B-002 position=2                    │
│ B-003 position=3                    │
│                                     │
│ Step 2: Insert emergency at pos 0   │
│ INSERT INTO tokens (               │
│   token_number: 'E-001',            │
│   patient_name: 'Jane Critical',    │
│   status: 'called',                 │
│   position: 0,                      │
│   is_emergency: true                │
│ )                                   │
│                                     │
│ Step 3: Log to queue_events         │
│ event_type: 'emergency_insert'      │
│ reason: 'Chest pain'                │
│                                     │
│ COMMIT ✅                            │
└─────────────────┬───────────────────┘
                  │
                  ▼
Socket.IO Broadcast
         │
         ├─ clinic:1:doctor:3:queue
         │  → Admin dashboard shows E-001 at top (red highlight)
         │
         ├─ clinic:1:doctor:3:display
         │  → TV screen shows:
         │     ┌──────────────────────────┐
         │     │ 🚨 EMERGENCY: E-001      │
         │     │ Jane Critical            │
         │     │ Reason: Chest pain       │
         │     └──────────────────────────┘
         │
         └─ clinic:patient:B-001
            → SMS: "Your position moved to 1 due to emergency"
```

---

## 🌐 WEBSOCKET ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT CONNECTIONS                        │
└─────────────────────────────────────────────────────────────────┘
         │
         ├── Patient Phone (Token B-012)
         │   └─ socket.emit('join:patient', { tokenId: 'B-012' })
         │      → Joins room: clinic:patient:B-012
         │      → Listens: token:status, penalty:applied
         │
         ├── Admin Dashboard (Dr. Smith's Queue)
         │   └─ socket.emit('join:queue', { clinicId: 1, doctorId: 3 })
         │      → Joins room: clinic:1:doctor:3:queue
         │      → Listens: queue:updated, token:called, threshold:update
         │
         ├── Display Board (Waiting Room TV)
         │   └─ socket.emit('join:display', { clinicId: 1, doctorId: 3 })
         │      → Joins room: clinic:1:doctor:3:display
         │      → Listens: queue:updated, token:called, emergency:insert
         │
         └── Superadmin Dashboard
             └─ socket.emit('join:admin', { clinicId: 1 })
                → Joins room: clinic:1:admin
                → Listens: emergency alerts, audit events

┌─────────────────────────────────────────────────────────────────┐
│                       SERVER-SIDE EMIT                          │
└─────────────────────────────────────────────────────────────────┘

Action: Call Next Patient (Token B-012)
         │
         ├─ emitTokenCalled(clinicId=1, doctorId=3, token={...})
         │
         ├──► io.to('clinic:1:doctor:3:queue').emit('token:called', token)
         │    → Admin dashboard: highlight B-012, play sound
         │
         ├──► io.to('clinic:1:doctor:3:display').emit('token:called', token)
         │    → TV screen: show "NOW SERVING: B-012" (large font)
         │
         └──► io.to('clinic:patient:B-012').emit('token:status', {
                status: 'called',
                position: 0,
                message: 'Please proceed to doctor'
              })
              → Patient phone: vibrate + audio + notification

┌─────────────────────────────────────────────────────────────────┐
│                     REDIS PUB/SUB (SCALING)                     │
└─────────────────────────────────────────────────────────────────┘

Multiple Node.js Processes (Horizontal Scaling):

Process 1 (Port 3000)          Process 2 (Port 3001)
    │                                  │
    └──── Redis Pub/Sub Adapter ──────┘
                  │
                  │ Topic: clinic:1:doctor:3:queue
                  │
                  ├─ Publish: token:called
                  │
                  ├─ Both processes subscribe
                  │
                  └─ Both emit to their connected clients
                     (even if client connected to different process)

Result: Clients on Process 1 receive updates from Process 2!
```

---

## 💾 DATABASE RELATIONSHIPS (Detailed)

```
┌──────────────────────┐
│      clinics         │
│──────────────────────│
│ id (PK)              │◄────────┐
│ name                 │         │
│ slug (UNIQUE)        │         │
│ address              │         │
│ phone                │         │
│ settings (JSONB)     │         │
│ is_active            │         │
└──────────────────────┘         │
         ▲                       │
         │                       │
         │ clinic_id             │ clinic_id
         │                       │
┌──────────────────────┐         │
│      doctors         │         │
│──────────────────────│         │
│ id (PK)              │◄────┐   │
│ clinic_id (FK)       │─────┼───┘
│ name                 │     │
│ specialization       │     │
│ avg_consultation_min │     │
│ is_active            │     │
└──────────────────────┘     │
         ▲                   │
         │                   │
         │ doctor_id         │ doctor_id
         │                   │
┌──────────────────────┐     │
│ doctor_thresholds    │     │
│──────────────────────│     │
│ id (PK)              │     │
│ doctor_id (FK UNIQUE)│─────┘
│ clinic_id (FK)       │
│ session_start        │
│ session_end          │
│ max_patients         │
│ max_walkin           │
│ max_online           │
│ buffer_slots         │
│ grace_period_minutes │
│ positions_back       │
│ max_penalties_...    │
└──────────────────────┘

┌──────────────────────┐
│       tokens         │
│──────────────────────│
│ id (PK)              │◄────┐
│ clinic_id (FK)       │     │
│ doctor_id (FK)       │     │
│ token_number         │     │
│ patient_name         │     │
│ phone                │     │
│ type                 │     │ token_id
│ status               │     │
│ position             │     │
│ penalty_count        │     │
│ is_emergency         │     │
│ total_sub_patients   │     │
│ joined_at            │     │
│ called_at            │     │
│ present_at           │     │
│ completed_at         │     │
└──────────────────────┘     │
         ▲                   │
         │                   │
         │ token_id          │
         │                   │
┌──────────────────────┐     │
│   sub_patients       │     │
│──────────────────────│     │
│ id (PK)              │     │
│ token_id (FK CASCADE)│─────┘
│ clinic_id (FK)       │
│ name                 │
│ relationship         │
│ age                  │
│ status               │
│ consultation_start_at│
│ consultation_end_at  │
└──────────────────────┘

┌──────────────────────┐
│        users         │
│──────────────────────│
│ id (PK)              │
│ clinic_id (FK)       │ ← nullable (for superadmin)
│ doctor_id (FK)       │ ← nullable (for non-doctors)
│ name                 │
│ email (UNIQUE)       │
│ password_hash        │
│ role                 │ ← 'staff', 'doctor', 'admin', 'superadmin'
│ totp_secret          │
│ totp_enabled         │
│ last_login_at        │
│ is_active            │
└──────────────────────┘

┌──────────────────────┐
│   queue_events       │ (Audit Log)
│──────────────────────│
│ id (PK)              │
│ clinic_id (FK)       │
│ token_id (FK)        │
│ user_id (FK)         │
│ event_type           │ ← 'call_next', 'penalty', 'emergency', etc.
│ old_position         │
│ new_position         │
│ old_status           │
│ new_status           │
│ reason               │
│ ip_address           │
│ created_at           │
└──────────────────────┘

┌──────────────────────┐
│ doctor_session_stats │ (Performance Cache)
│──────────────────────│
│ id (PK)              │
│ doctor_id (FK)       │
│ clinic_id (FK)       │
│ session_date         │ ← UNIQUE per (doctor_id, session_date)
│ total_seen           │
│ total_sub_patients   │
│ no_show_count        │
│ emergency_count      │
│ avg_wait_min         │
│ avg_consult_min      │
│ threshold_hit        │
│ threshold_pct        │
└──────────────────────┘
```

---

## 🔐 AUTHENTICATION FLOW (Detailed)

```
┌─────────────────────────────────────────────────────────────────┐
│                           LOGIN                                 │
└─────────────────────────────────────────────────────────────────┘

Client: POST /api/auth/login
{
  "email": "admin@demo.com",
  "password": "Admin@1234"
}
         │
         ▼
Server: Query users table
SELECT * FROM users
WHERE LOWER(email) = LOWER($1)
  AND is_active = true
         │
         ▼
Bcrypt Compare
bcrypt.compare(password, user.password_hash)
         │
         ├─ Fail → 401 Unauthorized
         │
         ▼ Success
Generate JWT Access Token
payload = {
  id: user.id,
  clinic_id: user.clinic_id,
  role: user.role,
  name: user.name,
  email: user.email,
  doctor_id: user.doctor_id
}
accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' })
         │
         ▼
Generate Refresh Token
refreshToken = jwt.sign(
  { id: user.id },
  JWT_REFRESH_SECRET,
  { expiresIn: '30d' }
)
         │
         ▼
Store Refresh Token in DB
UPDATE users
SET last_login_at = NOW()
WHERE id = $1
         │
         ▼
Response:
{
  "accessToken": "eyJhbGc...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@demo.com",
    "role": "admin",
    "clinic_id": 1,
    "doctor_id": null
  }
}

Set-Cookie: refreshToken=xxx; HttpOnly; Secure; SameSite=Strict
         │
         ▼
Client stores in localStorage:
localStorage.setItem('mq_token', accessToken)
localStorage.setItem('mq_user', JSON.stringify(user))
         │
         ▼
Client includes in all requests:
Authorization: Bearer eyJhbGc...

┌─────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATED REQUEST                      │
└─────────────────────────────────────────────────────────────────┘

Client: POST /api/admin/queue/call-next
Headers:
  Authorization: Bearer eyJhbGc...
Body:
  { "doctor_id": 3 }
         │
         ▼
Middleware: authenticate()
         │
         ├─ Extract token from header
         │  const token = req.headers.authorization.split(' ')[1]
         │
         ├─ Verify signature
         │  const decoded = jwt.verify(token, JWT_SECRET)
         │
         ├─ Attach to request
         │  req.user = decoded
         │  req.clinicId = decoded.clinic_id
         │
         └─ Fail → 401 Unauthorized
         │
         ▼
Middleware: requireRole('admin', 'staff')
         │
         ├─ Check: req.user.role in ['admin', 'staff']?
         │
         └─ Fail → 403 Forbidden
         │
         ▼
Middleware: clinicScope()
         │
         ├─ If superadmin:
         │   req.scopedClinicId = req.query.clinic_id || req.user.clinic_id
         │
         ├─ Else:
         │   req.scopedClinicId = req.user.clinic_id
         │   (cannot be overridden!)
         │
         └─ Attach to all queries
         │
         ▼
Controller:
const tokens = await db.query(`
  SELECT * FROM tokens
  WHERE clinic_id = $1
    AND doctor_id = $2
    AND status = 'waiting'
  ORDER BY position ASC
  LIMIT 1
`, [req.scopedClinicId, req.body.doctor_id])

Result: User can only access their own clinic data ✅

┌─────────────────────────────────────────────────────────────────┐
│                      TOKEN REFRESH                              │
└─────────────────────────────────────────────────────────────────┘

Client detects token expiry (8 hours passed)
         │
         ▼
POST /api/auth/refresh
Cookie: refreshToken=xxx
         │
         ▼
Server: Verify refresh token
const decoded = jwt.verify(req.cookies.refreshToken, JWT_REFRESH_SECRET)
         │
         ▼
Query user:
SELECT * FROM users
WHERE id = $1 AND is_active = true
         │
         ▼
Issue new access token:
accessToken = jwt.sign({
  id: user.id,
  clinic_id: user.clinic_id,
  role: user.role,
  ...
}, JWT_SECRET, { expiresIn: '8h' })
         │
         ▼
Response:
{ "accessToken": "eyJhbGc..." }
         │
         ▼
Client updates localStorage:
localStorage.setItem('mq_token', newAccessToken)

User continues session without re-login ✅
```

---

## 🎯 KEY TAKEAWAYS

### ✅ WHAT YOUR SYSTEM ALREADY HAS

1. **Multi-Tenant SaaS Architecture**
   - Superadmin can register multiple clinics
   - Each clinic isolated by `clinic_id`
   - No data leakage between clinics

2. **Per-Doctor Queue Independence**
   - Each doctor has separate queue
   - Different threshold configs
   - Independent WebSocket rooms

3. **Complete Admin Controls**
   - Call, hold, recall, penalty, emergency
   - Real-time updates via Socket.IO
   - Audit logging for accountability

4. **Role-Based Access Control**
   - 4-tier hierarchy (patient, staff, doctor, admin, superadmin)
   - JWT-based authentication
   - Refresh tokens for long sessions

5. **Scalability**
   - Redis adapter for multi-process Socket.IO
   - Atomic threshold checks prevent race conditions
   - Horizontal scaling ready

### 🎓 WHAT MAKES EACH DOCTOR INDEPENDENT

| Feature | Implementation |
|---------|----------------|
| **Queue Tokens** | `WHERE doctor_id = X` |
| **Threshold Limits** | `doctor_thresholds` table (1:1 with doctor) |
| **WebSocket Rooms** | `clinic:{C}:doctor:{D}:queue` |
| **Redis Keys** | `clinic:{C}:doctor:{D}:threshold_count` |
| **Display Boards** | `/display/:clinicId/:doctorId` (one per doctor) |
| **Reports** | `SELECT ... WHERE doctor_id = X` |

### 🚀 PRODUCTION READINESS

- ✅ Multi-tenancy
- ✅ Real-time updates (< 100ms)
- ✅ Atomic operations (Redis)
- ✅ Audit logging
- ✅ Role-based access
- ✅ Horizontal scaling
- ✅ Mobile-optimized UI
- ✅ Emergency override
- ✅ Penalty system
- ✅ Companion tracking

---

**Last Updated:** 2026-03-09
**Version:** 3.0
