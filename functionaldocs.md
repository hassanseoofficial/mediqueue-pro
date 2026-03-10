# MediQueue Pro — v3.0
### Smart Real-Time Medical Queue & Appointment Ticketing System
**Full System Requirements, Architecture, Game-Style UI Spec, Multi-Tenant Design & Deployment Guide**
*Stack: Node.js · React · Socket.IO · PostgreSQL · Redis | Scale: 10+ Clinics from Day 1 | Version 3.0 · 2026*

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Why This Stack — Decision Rationale](#2-why-this-stack--decision-rationale)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Multi-Tenant Design (10+ Clinics)](#4-multi-tenant-design-10-clinics)
5. [User Roles & Personas](#5-user-roles--personas)
6. [Core Functional Requirements](#6-core-functional-requirements)
   - 6.1 [Patient Ticket & Queue Module](#61-patient-ticket--queue-module)
   - 6.2 [Real-Time Queue Display](#62-real-time-queue-display)
   - 6.3 [Admin Dashboard — Game-Style UI ★](#63-admin-dashboard--game-style-ui-)
   - 6.4 [Online + Physical Appointment Booking](#64-online--physical-appointment-booking)
   - 6.5 [Penalty & Late-Arrival System](#65-penalty--late-arrival-system)
   - 6.6 [Emergency Override](#66-emergency-override)
   - 6.7 [Notifications & Alerts](#67-notifications--alerts)
   - 6.8 [Doctor Threshold & Slot Capacity Control ★](#68-doctor-threshold--slot-capacity-control-)
   - 6.9 [Multi-Patient Per Ticket ★](#69-multi-patient-per-ticket-)
7. [Doctor Portal — Reports & Analytics ★](#7-doctor-portal--reports--analytics-)
8. [Game-Style UI — Full React Component Spec ★](#8-game-style-ui--full-react-component-spec-)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Security Architecture](#10-security-architecture)
11. [Tech Stack Deep Dive](#11-tech-stack-deep-dive)
12. [Database Design (PostgreSQL)](#12-database-design-postgresql)
13. [API Endpoints](#13-api-endpoints)
14. [Socket.IO Event Reference](#14-socketio-event-reference)
15. [System Flow Diagrams](#15-system-flow-diagrams)
16. [Free Deployment Guide](#16-free-deployment-guide)
17. [Checkpoints & Milestones](#17-checkpoints--milestones)
18. [Proof of Concept (POC) Plan](#18-proof-of-concept-poc-plan)
19. [Dev Team & Cost Estimates ★](#19-dev-team--cost-estimates-)
20. [Future Enhancements](#20-future-enhancements)

---

## 1. Executive Summary

MediQueue Pro is a real-time, multi-tenant medical queue and appointment management system built to serve **10+ clinics simultaneously from launch**. Patients get virtual queue tickets via phone or web, receive live updates on their turn, and never need to stand in a physical line. Clinic staff operate through a **game-style mobile dashboard** with large one-touch action buttons. Doctors control their own session capacity and review daily performance reports.

**Key capabilities in v3.0:**

- Live queue management with sub-100ms WebSocket updates via Socket.IO
- Game-style admin dashboard — large color-coded buttons, designed for one-hand mobile use
- Doctor threshold system — automatically blocks overbooking per session
- Multi-patient tickets — one token for a whole family; each member tracked individually
- Doctor analytics portal — daily, weekly, and monthly performance reports
- Full multi-tenant isolation — one codebase, one deployment, unlimited clinics
- **$0 to launch** on free-tier infrastructure (Vercel + Railway + Supabase + Upstash)

---

## 2. Why This Stack — Decision Rationale

### Pure PHP — Rejected

| Concern | Detail |
|---|---|
| WebSockets | PHP is synchronous by default. Real WebSockets require Ratchet or Swoole — complex, poorly supported on shared hosting, not production-ready for this use case |
| Real-time performance | PHP spawns a new process per request. Cannot hold open thousands of socket connections efficiently |
| Multi-tenant scale | Managing 10+ clinic queues with live push updates in PHP is an architectural dead end |
| Verdict | ❌ Use PHP only if you have zero real-time requirements. This system's core feature IS real-time. |

### Node.js + React — Chosen ✅

| Advantage | Detail |
|---|---|
| Native async I/O | Node.js event loop holds 10,000+ concurrent socket connections on a single process with ease |
| Socket.IO | The industry standard for real-time web apps. Namespaces + rooms = perfect per-clinic, per-doctor isolation |
| One language | JavaScript on both frontend and backend — shared types, shared validation logic, smaller team |
| React + Tailwind | Best-in-class for building the game-style touch UI — large buttons, animations, responsive grid |
| Free deployment | Vercel (React), Railway/Render (Node), Supabase (PostgreSQL), Upstash (Redis) — all free to start |
| Ecosystem | npm has mature packages for every requirement: BullMQ (queues), node-postgres (DB), Twilio SDK, etc. |
| Python integration | Your team knows Python — use it for the analytics/reporting microservice if needed (optional) |

### PostgreSQL over MySQL

- **Row-Level Security (RLS)** — enforce clinic data isolation at the database level, not just application level
- **JSONB columns** — store flexible settings per clinic without schema migrations
- **Better multi-tenant patterns** — partial indexes, table partitioning, `clinic_id` scoping all work better in PostgreSQL
- **Supabase** — free hosted PostgreSQL with a built-in REST API and realtime hooks

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                  │
│                                                                 │
│  Patient Browser    Admin Mobile    Doctor Portal    Kiosk Tab  │
│  (React SPA)        (React SPA)     (React SPA)      (React)    │
└────────┬───────────────┬───────────────┬──────────────┬─────────┘
         │               │               │              │
         └───────────────┴───────────────┴──────────────┘
                                 │
                     HTTPS + Socket.IO (WSS)
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                    NODE.JS API SERVER                           │
│                   (Express + Socket.IO)                         │
│                                                                 │
│  REST API Routes      Socket.IO Namespaces    BullMQ Workers    │
│  /api/queue/*         /clinic/:id             SMS Jobs          │
│  /api/admin/*         /doctor/:id             Penalty Timers    │
│  /api/doctor/*        /display/:id            Report Gen Jobs   │
│  /api/auth/*                                                    │
└──────────┬──────────────────────────┬───────────────────────────┘
           │                          │
    ┌──────▼──────┐           ┌───────▼───────┐
    │ PostgreSQL  │           │     Redis      │
    │ (Supabase)  │           │   (Upstash)    │
    │             │           │               │
    │ All clinic  │           │ Socket.IO      │
    │ data with   │           │ adapter        │
    │ clinic_id   │           │ BullMQ queues  │
    │ isolation   │           │ Threshold      │
    │             │           │ counters       │
    └─────────────┘           └───────────────┘
           │
    ┌──────▼──────┐
    │   Twilio    │
    │ SMS Gateway │
    └─────────────┘
```

### Request Flow Summary

1. Patient joins queue → `POST /api/queue/join` → DB insert → Redis counter check → Socket.IO broadcast to `clinic:1:doctor:3` room
2. Admin clicks CALL NEXT → `POST /api/admin/queue/call-next` → DB update → Socket.IO broadcast → BullMQ schedules penalty timer job
3. Penalty timer fires → BullMQ worker updates DB → Socket.IO broadcast → Twilio SMS sent
4. Doctor views report → `GET /api/doctor/reports/daily` → PostgreSQL aggregation query → JSON response

---

## 4. Multi-Tenant Design (10+ Clinics)

### Strategy: Shared Database, Isolated by `clinic_id`

Every table has a `clinic_id` column. All queries are scoped to the authenticated user's clinic. This gives full data isolation without the operational overhead of separate databases per clinic.

```sql
-- Every query is always scoped like this:
SELECT * FROM tokens
WHERE clinic_id = $1   -- always injected from JWT
AND doctor_id = $2
AND date = CURRENT_DATE;
```

### PostgreSQL Row-Level Security (RLS)

```sql
-- Enforce at DB level so even a buggy query can't leak cross-clinic data
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY clinic_isolation ON tokens
  USING (clinic_id = current_setting('app.current_clinic_id')::INT);
```

### Socket.IO Room Namespacing

```
Room naming convention:
  clinic:{clinic_id}:doctor:{doctor_id}:queue    → queue updates for a doctor
  clinic:{clinic_id}:doctor:{doctor_id}:display  → public display board
  clinic:{clinic_id}:admin                        → admin dashboard events
  clinic:{clinic_id}:patient:{token_id}           → individual patient status
```

Each clinic's WebSocket traffic is fully isolated. A socket.emit in Clinic A never reaches Clinic B.

### Redis Key Namespacing

```
Keys are prefixed: clinic:{id}:doctor:{id}:threshold_count
                   clinic:{id}:doctor:{id}:queue_position
                   clinic:{id}:jobs:penalty:{token_id}
```

### Tenant Onboarding

- Super Admin creates a new clinic via `/api/superadmin/clinics`
- Auto-generates: clinic record, default penalty settings, default threshold settings
- Super Admin adds doctors, assigns admin users
- Clinic is live immediately — no deployment or infra change needed

---

## 5. User Roles & Personas

| Role | Auth | Scope | Key Capabilities |
|---|---|---|---|
| Patient (Walk-in) | None (public) | Single token | Get ticket, view live status, add companions |
| Patient (Online) | Optional account | Own appointments | Book, cancel, reschedule; add family members |
| Receptionist | JWT (staff role) | Own clinic | Check-in, call next, mark no-show, confirm presence |
| Doctor | JWT (doctor role) | Own clinic + own queue | Set threshold, view own queue (read-only), access reports |
| Clinic Admin | JWT (admin role) | Own clinic | Full queue control, game dashboard, all doctor queues, settings |
| Super Admin | JWT (superadmin role) | All clinics | Onboard clinics, global settings, cross-clinic reports, audit logs |

---

## 6. Core Functional Requirements

### 6.1 Patient Ticket & Queue Module

#### 6.1.1 Walk-in Token Generation

- Patient opens a URL (e.g., `queue.mediqueue.app/clinic/city-hospital`) or uses an in-clinic kiosk tablet.
- Enters full name and mobile phone number. No account required.
- Optionally adds companion patients (see Section 6.9).
- System checks doctor threshold atomically via Redis counter before creating the token.
- If threshold is full or session is outside time window → ticket blocked with a clear message.
- Token created in PostgreSQL, position assigned, Socket.IO broadcast fired.
- Patient receives a token page URL with live WebSocket-powered status.

#### 6.1.2 Token Information Displayed to Patient

- Token number (e.g., **B-042**) in large text.
- Currently serving number — live, no refresh needed.
- People ahead: total count with breakdown (physical present vs online).
- Estimated wait time (avg consultation minutes × people ahead).
- Your status badge: `Waiting` / `Called` / `In Consultation` / `Completed` / `Penalized`.
- Doctor's remaining slots today (e.g., *"8 slots remaining"*).
- Sub-patient list if companions were added.

---

### 6.2 Real-Time Queue Display

- Dedicated display page for a wall-mounted screen or TV in the waiting room.
- Shows: **NOW SERVING** (large), last 3 called tokens, estimated wait for next 3.
- Multi-patient tokens show: `B-042 (3 patients — Ali, Sara, Ahmed)`.
- Emergency tokens: red background, **EMERGENCY** badge, animated pulse.
- Updates via Socket.IO — zero polling, sub-100ms latency.
- Separate display URL per doctor: `/display/clinic/1/doctor/3`.
- Optional audio: browser Web Speech API reads out token number on change.
- Threshold remaining shown in footer: *"12 slots remaining today"*.

---

### 6.3 Admin Dashboard — Game-Style UI ★

> Full React component specification is in **Section 8**. This section covers the functional requirements.

#### 6.3.1 Design Principles

- **Designed for one-hand mobile use** — primary actions reachable with a thumb on a 6-inch phone screen.
- All buttons minimum **80×80px** on mobile, **120×120px** on tablet.
- Distinct color per action — no two adjacent buttons share a color.
- Destructive actions (Penalty, No-Show) require **hold-to-confirm** (press and hold 1.5 seconds) with a visual fill animation — no accidental triggers.
- **Immediate visual + haptic feedback** on every button press (vibration API on mobile).
- No nested menus for primary actions — everything one tap away.

#### 6.3.2 Primary Action Buttons

| Button | Color | Icon | Action | Input Type |
|---|---|---|---|---|
| **CALL NEXT** | `#27AE60` Green | ▶ | Advances queue to next token; Socket.IO broadcast | Single tap |
| **MARK PRESENT** | `#2980B9` Blue | ✔ | Confirms physical arrival of called patient | Single tap |
| **RE-CALL** | `#17A589` Teal | ↻ | Re-announces current token (screen + audio) | Single tap |
| **ON HOLD** | `#E67E22` Orange | ⏸ | Moves token to on-hold sub-queue | Single tap |
| **PENALTY** | `#D4AC0D` Amber | ⚠ | Moves token back N positions | **Hold 1.5s** |
| **NO-SHOW** | `#C0392B` Red | ✖ | Removes token from queue | **Hold 1.5s** |
| **EMERGENCY** | `#7D3C98` Purple | ★ | Inserts emergency at queue front | Single tap + reason modal |
| **COMPLETE** | `#1E8449` Dark Green | ✓✓ | Marks all sub-patients done; advances queue | Single tap |

#### 6.3.3 Secondary Controls

- **NOW SERVING card** — always pinned to top: token number, patient name, timer counting up.
- **NEXT UP strip** — horizontal scroll of next 3 tokens as preview cards.
- **THRESHOLD METER** — animated progress bar: Green → Yellow → Red.
- **QUEUE LIST** — collapsible bottom sheet showing full queue (swipe up to expand).
- **Doctor Selector** — top dropdown to switch between doctors (clinic admin only).
- **Queue Pause** — toggle switch to pause/resume new ticket generation.

---

### 6.4 Online + Physical Appointment Booking

#### 6.4.1 Online Appointment Flow

1. Patient visits booking page, selects clinic → doctor → date → time slot.
2. Only slots within the active threshold window and under capacity are shown.
3. Patient enters name, phone, optionally adds companions.
4. Booking confirmed; token pre-assigned; SMS confirmation sent.
5. Auto SMS reminder 1 hour before appointment.
6. Patient checks in on arrival (taps check-in link in SMS) to activate queue position.

#### 6.4.2 Interleaving Logic (Walk-in vs Online)

- Configurable ratio per clinic: every N online tokens served, 1 walk-in served (default: 2 online : 1 walk-in).
- Admin can pause either stream independently from the dashboard.
- When threshold is full, both streams are blocked.

---

### 6.5 Penalty & Late-Arrival System

#### 6.5.1 Penalty Rules

- Token is called. BullMQ schedules a penalty job with a delay equal to the grace period (default: 5 minutes).
- If admin marks patient **Present** before the timer fires → BullMQ job is cancelled. No penalty.
- If timer fires and patient is still in `called` state → penalty applied:
  - `penalty_count` incremented in DB.
  - Token position moved back N positions (default: 2) via atomic Redis queue reorder.
  - Socket.IO broadcast updates all affected patients' position counts.
  - Twilio SMS sent to patient.
- Second penalty → token moved to end of queue.
- Third penalty → token marked `no_show`, removed from active queue.

#### 6.5.2 Configuration per Clinic

```json
{
  "grace_period_minutes": 5,
  "positions_back": 2,
  "max_penalties_before_noshow": 3,
  "penalty_enabled": true,
  "vip_penalty_exempt": false
}
```

---

### 6.6 Emergency Override

- Admin taps **EMERGENCY** button (purple star) on game dashboard.
- A modal slides up (bottom sheet on mobile) with a required **Reason** text field.
- Emergency token inserted at position 1 via atomic Redis queue update.
- All other tokens shift by +1 — their Socket.IO status pages update instantly.
- Display board shows red **EMERGENCY** pulsing banner.
- Emergency tokens bypass threshold (buffer slots reserved for this).
- Full audit log entry: `admin_id`, `reason`, `timestamp`, `ip_address`.

---

### 6.7 Notifications & Alerts

| Event | Channel | Recipient | Timing |
|---|---|---|---|
| Token generated | SMS + in-app | Patient | Immediate |
| 2 people ahead | SMS / WhatsApp | Patient | Triggered by queue advance |
| Token called | SMS + audio (display) | Patient | Immediate |
| Penalty applied | SMS | Patient | Immediate |
| No-show marked | SMS | Patient | Immediate |
| Emergency inserted | Socket.IO in-app | All waiting patients | Immediate |
| Threshold 80% full | In-app warning | Admin | Immediate |
| Threshold 100% full | In-app + kiosk banner | Admin + kiosk | Immediate |
| Appointment reminder | SMS + email | Online patient | 1 hour before slot |
| Queue paused | SMS + in-app | All active patients | Immediate |
| Daily report ready | Email + portal | Doctor | End of session |

---

### 6.8 Doctor Threshold & Slot Capacity Control ★

#### 6.8.1 Configuration Fields

| Field | Description | Example |
|---|---|---|
| `session_start` | When ticket generation opens | `09:00` |
| `session_end` | When ticket generation closes | `14:00` |
| `max_patients` | Hard cap: walk-in + online combined | `30` |
| `max_walkin` | Sub-cap for walk-ins only | `20` |
| `max_online` | Sub-cap for online only | `15` |
| `buffer_slots` | Reserved for emergencies | `2` |
| `avg_consultation_min` | For wait-time estimates | `8` |
| `reset_cron` | When counter resets | `0 0 * * *` (midnight daily) |

#### 6.8.2 Atomic Threshold Check (Redis + PostgreSQL)

```
On ticket generation request:
  1. INCR clinic:{id}:doctor:{id}:threshold_count in Redis (atomic)
  2. If returned value > max_patients → DECR (rollback) → return 429 "Slots Full"
  3. If session time check fails → return 423 "Session Closed"
  4. Else → INSERT token in PostgreSQL → emit Socket.IO threshold update
```

Using Redis INCR ensures atomicity even with 1000 concurrent requests — no race conditions possible.

#### 6.8.3 Threshold UI States

- **Slots available** — green counter badge: *"22 slots remaining"*
- **80% full** — yellow warning banner on admin dashboard
- **100% full** — red FULL badge on kiosk; ticket button disabled; admin notified
- **Session closed** — grey CLOSED badge with next session time shown

---

### 6.9 Multi-Patient Per Ticket ★

#### 6.9.1 Flow

1. Patient checks *"Add companions"* on ticket form.
2. Adds up to N companion names + optional relationship/age.
3. System creates 1 master `token` record + N `sub_patient` records (linked by `token_id`).
4. **Each sub-patient decrements threshold by 1** (3-person ticket = 3 slots used).
5. Token label: `B-042 · Ali, Sara, Ahmed (3 patients)`.
6. Doctor sees expandable card with each companion listed.
7. Admin/doctor marks each sub-patient individually: `Waiting → In Consultation → Done`.
8. Master token status = `completed` only when all sub-patients = `done`.

#### 6.9.2 Rules

- Max companions per ticket: configurable (default: 4).
- Companions cannot be added after the token is called.
- SMS notifications go to the primary ticket holder's phone only.
- Consultation time tracked per sub-patient for accurate averages.

> **Example:** Parent brings 3 children for check-up. 1 token issued (B-042). 3 slots deducted from threshold. Doctor marks each child done individually. Token completes when all 3 are done. Daily stats: 3 sub-patients recorded for the doctor.

---

## 7. Doctor Portal — Reports & Analytics ★

### 7.1 Dashboard Cards (Today at a Glance)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  PATIENTS SEEN  │  │   SUB-PATIENTS  │  │  AVG WAIT TIME  │
│      22         │  │      31         │  │    14 min       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  SLOTS USED     │  │   NO-SHOWS      │  │ AVG CONSULT     │
│    22 / 30      │  │      3          │  │    8 min        │
│  ████████░░     │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 7.2 Metrics Tracked

| Metric | Source |
|---|---|
| Total patients seen (master tokens completed) | `tokens` table |
| Total sub-patients seen | `sub_patients` table |
| Confirmed physical patients | `queue_events` table |
| Walk-in vs online split | `tokens.type` |
| No-show count | `tokens.status = no_show` |
| Average wait time | `AVG(called_at - joined_at)` |
| Average consultation time | `AVG(completed_at - present_at)` |
| Penalty events | `SUM(penalty_count > 0)` |
| Emergency cases | `COUNT(is_emergency = true)` |
| Threshold utilization % | `(used / max) * 100` |

### 7.3 Available Report Views

| Report | Frequency | Format | Auto-email |
|---|---|---|---|
| Daily Summary | Per session | PDF + CSV | Yes (opt-in) |
| Weekly Trends | 7-day rolling | Charts + PDF | Monday 8AM (opt-in) |
| Monthly Report | Calendar month | PDF | 1st of month (opt-in) |
| Threshold History | 30-day | Charts | On demand |
| Patient History | Any range | Table + CSV | On demand |
| All-Doctor Report | Any range | Consolidated PDF | Super Admin only |

---

## 8. Game-Style UI — Full React Component Spec ★

### 8.1 Design System

```css
/* Design tokens for game-style UI */
--btn-primary-size-mobile:  80px;   /* min touch target */
--btn-primary-size-tablet:  120px;  /* tablet / kiosk */
--btn-font-size-mobile:     13px;
--btn-font-size-tablet:     16px;
--btn-icon-size-mobile:     28px;
--btn-icon-size-tablet:     40px;
--btn-border-radius:        16px;
--btn-shadow: 0 6px 0 rgba(0,0,0,0.3);       /* 3D raised effect */
--btn-shadow-pressed: 0 2px 0 rgba(0,0,0,0.3); /* pressed state */
--animation-press: translateY(4px);           /* physical click feel */
--hold-duration:  1500ms;
```

### 8.2 ActionButton Component

```jsx
// components/ActionButton.jsx
import { useState, useRef, useCallback } from 'react';

const ActionButton = ({
  label,
  icon,
  color,        // hex background color
  textColor = '#FFFFFF',
  onTap,        // for single-tap actions
  onHoldConfirm, // for hold-to-confirm actions (Penalty, No-Show)
  disabled = false,
  size = 'md', // 'sm' | 'md' | 'lg'
  pulse = false, // animated pulse (emergency indicator)
}) => {
  const [holdProgress, setHoldProgress] = useState(0);
  const [isPressed, setIsPressed]       = useState(false);
  const [isCompleted, setIsCompleted]   = useState(false);
  const holdTimer    = useRef(null);
  const progressRef  = useRef(null);
  const HOLD_MS = 1500;

  const sizeMap = {
    sm: 'w-16 h-16 text-xs',
    md: 'w-20 h-20 text-sm',     // 80px — mobile default
    lg: 'w-28 h-28 text-base',   // 112px — tablet
  };

  // ── Single-tap handler ──
  const handleTap = useCallback(() => {
    if (disabled || onHoldConfirm) return;
    if (navigator.vibrate) navigator.vibrate(50); // haptic
    onTap?.();
  }, [disabled, onTap, onHoldConfirm]);

  // ── Hold-to-confirm handler ──
  const startHold = useCallback(() => {
    if (!onHoldConfirm || disabled) return;
    setIsPressed(true);
    const startTime = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed  = Date.now() - startTime;
      const progress = Math.min((elapsed / HOLD_MS) * 100, 100);
      setHoldProgress(progress);

      if (elapsed >= HOLD_MS) {
        clearInterval(progressRef.current);
        setIsCompleted(true);
        setHoldProgress(0);
        setIsPressed(false);
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // double haptic
        setTimeout(() => setIsCompleted(false), 600);
        onHoldConfirm();
      }
    }, 16); // ~60fps
  }, [onHoldConfirm, disabled]);

  const cancelHold = useCallback(() => {
    clearInterval(progressRef.current);
    setHoldProgress(0);
    setIsPressed(false);
  }, []);

  return (
    <button
      className={`
        relative flex flex-col items-center justify-center gap-1
        rounded-2xl font-bold select-none cursor-pointer
        transition-all duration-75 active:scale-95
        ${sizeMap[size]}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${pulse ? 'animate-pulse' : ''}
        ${isCompleted ? 'scale-110' : ''}
      `}
      style={{
        backgroundColor: color,
        color: textColor,
        boxShadow: isPressed
          ? '0 2px 0 rgba(0,0,0,0.3)'
          : '0 6px 0 rgba(0,0,0,0.3)',
        transform: isPressed ? 'translateY(4px)' : 'translateY(0)',
      }}
      onPointerDown={onHoldConfirm ? startHold : undefined}
      onPointerUp={onHoldConfirm ? cancelHold : undefined}
      onPointerLeave={onHoldConfirm ? cancelHold : undefined}
      onClick={onTap ? handleTap : undefined}
      disabled={disabled}
      aria-label={label}
    >
      {/* Hold progress ring overlay */}
      {onHoldConfirm && holdProgress > 0 && (
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background: `conic-gradient(
              rgba(255,255,255,0.5) ${holdProgress * 3.6}deg,
              transparent ${holdProgress * 3.6}deg
            )`,
          }}
        />
      )}

      {/* Icon */}
      <span className="text-2xl leading-none z-10" aria-hidden>
        {icon}
      </span>

      {/* Label */}
      <span className="text-center leading-tight z-10 px-1">
        {onHoldConfirm && holdProgress > 0
          ? `${Math.round(holdProgress)}%`
          : label}
      </span>
    </button>
  );
};

export default ActionButton;
```

### 8.3 Admin Game Panel Layout

```jsx
// pages/AdminDashboard.jsx  (simplified structure)

const AdminDashboard = ({ doctorId, clinicId }) => {
  const { queue, currentToken, threshold } = useQueueStore();
  const { callNext, markPresent, applyPenalty, markNoShow,
          triggerEmergency, markComplete } = useQueueActions();

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── TOP STATUS BAR ── */}
      <StatusBar currentToken={currentToken} threshold={threshold} />

      {/* ── NOW SERVING CARD ── */}
      <NowServingCard token={currentToken} />

      {/* ── NEXT UP STRIP ── */}
      <NextUpStrip queue={queue.slice(0, 3)} />

      {/* ── PRIMARY ACTION GRID ── */}
      <div className="grid grid-cols-4 gap-3 p-4">
        <ActionButton
          label="CALL NEXT"  icon="▶"
          color="#27AE60"    size="lg"
          onTap={callNext}
        />
        <ActionButton
          label="PRESENT"    icon="✔"
          color="#2980B9"    size="lg"
          onTap={markPresent}
          disabled={!currentToken}
        />
        <ActionButton
          label="RE-CALL"    icon="↻"
          color="#17A589"    size="lg"
          onTap={reCall}
        />
        <ActionButton
          label="ON HOLD"    icon="⏸"
          color="#E67E22"    size="lg"
          onTap={markOnHold}
        />
        <ActionButton
          label="PENALTY"    icon="⚠"
          color="#D4AC0D"    size="lg"
          onHoldConfirm={applyPenalty}  {/* hold 1.5s */}
        />
        <ActionButton
          label="NO-SHOW"    icon="✖"
          color="#C0392B"    size="lg"
          onHoldConfirm={markNoShow}    {/* hold 1.5s */}
        />
        <ActionButton
          label="EMERGENCY"  icon="★"
          color="#7D3C98"    size="lg"
          onTap={() => setEmergencyModalOpen(true)}
          pulse={hasEmergency}
        />
        <ActionButton
          label="COMPLETE"   icon="✓✓"
          color="#1E8449"    size="lg"
          onTap={markComplete}
          disabled={!currentToken}
        />
      </div>

      {/* ── QUEUE BOTTOM SHEET (swipe up) ── */}
      <QueueBottomSheet queue={queue} />

      {/* ── EMERGENCY MODAL ── */}
      <EmergencyModal
        open={emergencyModalOpen}
        onConfirm={(reason) => triggerEmergency(reason)}
        onClose={() => setEmergencyModalOpen(false)}
      />
    </div>
  );
};
```

### 8.4 NowServingCard Component

```jsx
// Prominent card showing current patient — always visible at top
const NowServingCard = ({ token }) => (
  <div className="mx-4 mb-2 rounded-2xl bg-gradient-to-r
                  from-blue-900 to-indigo-900 p-4 shadow-xl">
    <p className="text-xs uppercase tracking-widest text-blue-300 mb-1">
      Now Serving
    </p>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-5xl font-black tracking-tight">
          {token?.token_number ?? '—'}
        </p>
        <p className="text-lg text-blue-200 mt-1">
          {token?.patient_name}
          {token?.total_sub_patients > 1 &&
            <span className="ml-2 text-sm bg-blue-700 px-2 py-0.5 rounded-full">
              {token.total_sub_patients} patients
            </span>
          }
        </p>
      </div>
      <ElapsedTimer startTime={token?.called_at} />
    </div>
  </div>
);
```

### 8.5 ThresholdMeter Component

```jsx
const ThresholdMeter = ({ used, max }) => {
  const pct   = Math.round((used / max) * 100);
  const color = pct < 70 ? '#27AE60' : pct < 90 ? '#E67E22' : '#C0392B';
  const label = pct >= 100 ? 'FULL' : `${max - used} left`;

  return (
    <div className="px-4 py-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Capacity: {used}/{max}</span>
        <span style={{ color }} className="font-bold">{label}</span>
      </div>
      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};
```

### 8.6 Socket.IO Hook (Real-time Queue State)

```jsx
// hooks/useQueueSocket.js
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useQueueStore } from '../store/queueStore';

export const useQueueSocket = (clinicId, doctorId, token) => {
  const { setQueue, updateToken, setCurrentServing } = useQueueStore();

  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    // Join the room for this doctor's queue
    socket.emit('join:queue', { clinicId, doctorId });

    socket.on('queue:updated',    (queue)  => setQueue(queue));
    socket.on('token:called',     (token)  => setCurrentServing(token));
    socket.on('token:status',     (update) => updateToken(update));
    socket.on('threshold:update', (data)   => setThreshold(data));
    socket.on('emergency:insert', (token)  => handleEmergency(token));

    return () => socket.disconnect();
  }, [clinicId, doctorId, token]);
};
```

### 8.7 Mobile Responsive Layout Strategy

```
Mobile (< 640px):   2×4 button grid  — 80px buttons, bottom sheet queue
Tablet (640-1024px): 4×2 button grid  — 120px buttons, side panel queue
Desktop (> 1024px): 4×2 button grid  — 120px buttons, full sidebar queue
```

```jsx
// Tailwind responsive grid
<div className="
  grid gap-3 p-4
  grid-cols-2 sm:grid-cols-4   // 2 cols mobile, 4 cols tablet+
">
  {/* buttons */}
</div>
```

---

## 9. Non-Functional Requirements

| Requirement | Specification |
|---|---|
| WebSocket latency | Queue updates delivered < 100ms after event |
| API response time | 95th percentile < 300ms under normal load |
| Concurrent connections | 10,000+ simultaneous Socket.IO connections per server instance |
| Concurrent clinics | 10+ clinics with isolated namespaces, no cross-contamination |
| Uptime | 99.5% target; graceful HTTP fallback (polling) if WebSocket unavailable |
| Button touch target | Minimum 80×80px on mobile; 120×120px on tablet (WCAG 2.5.5) |
| Threshold atomicity | Redis INCR guarantees zero race conditions under any concurrency |
| Mobile performance | Lighthouse mobile score > 85; First Contentful Paint < 2s on 4G |
| Offline resilience | Patient status page falls back to 15s polling if socket disconnects |
| Data isolation | RLS at PostgreSQL level; clinic_id on every query |
| Language/RTL | Urdu, Arabic RTL supported via `dir="rtl"` + Tailwind RTL plugin |
| Accessibility | WCAG 2.1 AA; all buttons have aria-label; contrast ratio > 4.5:1 |

---

## 10. Security Architecture

### 10.1 Authentication

- **JWT** (RS256 asymmetric) — access token (8h), refresh token (30d, HTTP-only cookie).
- **2FA via TOTP** (otpauth + speakeasy npm packages) for all admin and doctor accounts.
- `clinic_id` embedded in JWT payload — all API middleware validates it on every request.
- Role hierarchy enforced in Express middleware: `requireRole('admin')`, `requireRole('doctor')`, etc.

### 10.2 Multi-Tenant Security

```javascript
// Every protected route uses this middleware
const clinicScope = (req, res, next) => {
  req.clinicId = req.user.clinic_id; // from JWT — cannot be spoofed
  next();
};

// Every DB query uses req.clinicId — never trusts client-provided clinic_id
const tokens = await db.query(
  'SELECT * FROM tokens WHERE clinic_id = $1 AND id = $2',
  [req.clinicId, req.params.id]
);
```

### 10.3 OWASP Compliance

- **SQL Injection:** `node-postgres` parameterized queries exclusively. Zero raw string interpolation.
- **XSS:** React escapes all output by default. Helmet.js sets CSP headers.
- **CSRF:** SameSite=Strict cookies + CSRF token for non-SPA endpoints.
- **Rate limiting:** `express-rate-limit` — 60 req/min public; 200 req/min authenticated.
- **Input validation:** `zod` schemas on every API endpoint — server-side only.
- **Brute force:** 5 failed login attempts → 15-minute lockout stored in Redis.

### 10.4 Infrastructure

- HTTPS enforced (Let's Encrypt via Caddy reverse proxy or Railway auto-TLS).
- All secrets in environment variables — never in source code or version control.
- PostgreSQL RLS as a second layer of data isolation defense.
- Audit log for all admin/doctor actions: `user_id`, `action`, `target`, `timestamp`, `ip`.

---

## 11. Tech Stack Deep Dive

### 11.1 Full Stack

| Layer | Technology | Package / Service | Purpose |
|---|---|---|---|
| **Frontend** | React 18 + Vite | `react`, `vite` | UI framework + fast build tool |
| **Styling** | Tailwind CSS 3 | `tailwindcss` | Game-style utility CSS; responsive; RTL plugin |
| **State Management** | Zustand | `zustand` | Lightweight global queue + UI state |
| **Real-time (client)** | Socket.IO Client | `socket.io-client` | WebSocket connection to server |
| **Routing** | React Router 6 | `react-router-dom` | SPA routing for patient/admin/doctor views |
| **Charts** | Recharts | `recharts` | Doctor portal trend charts |
| **Backend** | Node.js 20 + Express | `express` | REST API server |
| **Real-time (server)** | Socket.IO Server | `socket.io` | WebSocket rooms per clinic/doctor |
| **Database** | PostgreSQL 15 | `pg` (node-postgres) | Primary data store; multi-tenant |
| **DB Migrations** | node-pg-migrate | `node-pg-migrate` | Schema version control |
| **Cache / Queue** | Redis (Upstash) | `ioredis` | Threshold counters, socket adapter |
| **Job Queue** | BullMQ | `bullmq` | Penalty timers, SMS jobs, report generation |
| **Socket.IO Scale** | `@socket.io/redis-adapter` | — | Sync socket events across multiple Node processes |
| **Auth** | JWT + 2FA | `jsonwebtoken`, `speakeasy` | Stateless auth + TOTP |
| **Validation** | Zod | `zod` | Schema validation on every endpoint |
| **SMS** | Twilio | `twilio` | Patient SMS notifications |
| **Email** | Nodemailer + SendGrid | `nodemailer` | Doctor reports, appointment reminders |
| **PDF** | Puppeteer (headless) | `puppeteer` | Doctor report PDF generation |
| **Security** | Helmet + rate-limit | `helmet`, `express-rate-limit` | HTTP headers, brute force protection |
| **Hosting (React)** | Vercel | — | Free CDN, auto-deploy from GitHub |
| **Hosting (Node)** | Railway | — | Free $5/mo credit; persistent processes |
| **DB Hosting** | Supabase | — | Free 500MB PostgreSQL; RLS built-in |
| **Redis Hosting** | Upstash | — | Free 10k req/day; serverless Redis |

### 11.2 Project Structure

```
mediqueue/
├── client/                      # React frontend (deployed to Vercel)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Patient/         # Queue join, token status
│   │   │   ├── Admin/           # Game-style dashboard
│   │   │   ├── Doctor/          # Reports portal
│   │   │   └── Display/         # Waiting room TV screen
│   │   ├── components/
│   │   │   ├── ActionButton/    # Game button component
│   │   │   ├── NowServingCard/
│   │   │   ├── ThresholdMeter/
│   │   │   ├── QueueBottomSheet/
│   │   │   └── SubPatientList/
│   │   ├── hooks/
│   │   │   ├── useQueueSocket.js
│   │   │   └── useQueueActions.js
│   │   └── store/
│   │       └── queueStore.js    # Zustand store
│   └── package.json
│
├── server/                      # Node.js API (deployed to Railway)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── queue.js         # Patient-facing queue routes
│   │   │   ├── admin.js         # Admin action routes
│   │   │   ├── doctor.js        # Doctor portal + reports
│   │   │   └── auth.js
│   │   ├── sockets/
│   │   │   ├── queueSocket.js   # Socket.IO event handlers
│   │   │   └── rooms.js         # Room naming helpers
│   │   ├── jobs/
│   │   │   ├── penaltyJob.js    # BullMQ penalty timer
│   │   │   ├── smsJob.js        # Twilio SMS worker
│   │   │   └── reportJob.js     # Daily report generation
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT + clinic scope
│   │   │   └── rateLimit.js
│   │   └── db/
│   │       ├── index.js         # pg pool
│   │       └── migrations/      # node-pg-migrate files
│   └── package.json
│
└── README.md
```

---

## 12. Database Design (PostgreSQL)

### 12.1 Core Tables

```sql
-- Clinics (tenants)
CREATE TABLE clinics (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,  -- URL identifier
  address       TEXT,
  settings      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Doctors
CREATE TABLE doctors (
  id                      SERIAL PRIMARY KEY,
  clinic_id               INT REFERENCES clinics(id) ON DELETE CASCADE,
  name                    VARCHAR(200) NOT NULL,
  specialization          VARCHAR(100),
  avg_consultation_min    INT DEFAULT 8,
  is_active               BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Doctor threshold settings
CREATE TABLE doctor_thresholds (
  id                  SERIAL PRIMARY KEY,
  doctor_id           INT REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id           INT REFERENCES clinics(id),
  session_start       TIME NOT NULL DEFAULT '09:00',
  session_end         TIME NOT NULL DEFAULT '17:00',
  max_patients        INT NOT NULL DEFAULT 30,
  max_walkin          INT DEFAULT 20,
  max_online          INT DEFAULT 15,
  buffer_slots        INT DEFAULT 2,
  reset_cron          VARCHAR(50) DEFAULT '0 0 * * *',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Master queue tokens
CREATE TABLE tokens (
  id                  SERIAL PRIMARY KEY,
  clinic_id           INT REFERENCES clinics(id),
  doctor_id           INT REFERENCES doctors(id),
  token_number        VARCHAR(20) NOT NULL,        -- e.g. "B-042"
  patient_name        VARCHAR(200) NOT NULL,
  phone_encrypted     TEXT NOT NULL,
  type                VARCHAR(20) DEFAULT 'walkin', -- walkin | online
  status              VARCHAR(30) DEFAULT 'waiting',
  position            INT NOT NULL,
  penalty_count       INT DEFAULT 0,
  is_emergency        BOOLEAN DEFAULT FALSE,
  total_sub_patients  INT DEFAULT 1,
  joined_at           TIMESTAMPTZ DEFAULT NOW(),
  called_at           TIMESTAMPTZ,
  present_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN (
    'waiting','called','present','in_consultation',
    'penalized','no_show','completed','on_hold'
  ))
);

-- Sub-patients (companions per ticket)
CREATE TABLE sub_patients (
  id                      SERIAL PRIMARY KEY,
  token_id                INT REFERENCES tokens(id) ON DELETE CASCADE,
  clinic_id               INT REFERENCES clinics(id),
  name                    VARCHAR(200) NOT NULL,
  relationship            VARCHAR(100),
  age                     INT,
  status                  VARCHAR(30) DEFAULT 'waiting',
  consultation_start_at   TIMESTAMPTZ,
  consultation_end_at     TIMESTAMPTZ
);

-- Online appointments
CREATE TABLE appointments (
  id                SERIAL PRIMARY KEY,
  token_id          INT REFERENCES tokens(id),
  clinic_id         INT REFERENCES clinics(id),
  doctor_id         INT REFERENCES doctors(id),
  patient_phone     TEXT,
  scheduled_date    DATE NOT NULL,
  scheduled_time    TIME NOT NULL,
  reminder_sent     BOOLEAN DEFAULT FALSE,
  status            VARCHAR(30) DEFAULT 'booked',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- System users (admin, staff, doctor, superadmin)
CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  clinic_id         INT REFERENCES clinics(id),  -- NULL for superadmin
  name              VARCHAR(200) NOT NULL,
  email             VARCHAR(200) UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,
  role              VARCHAR(30) NOT NULL,
  totp_secret       TEXT,
  totp_enabled      BOOLEAN DEFAULT FALSE,
  last_login_at     TIMESTAMPTZ,
  is_active         BOOLEAN DEFAULT TRUE,
  CONSTRAINT valid_role CHECK (role IN ('staff','doctor','admin','superadmin'))
);

-- Audit log
CREATE TABLE queue_events (
  id            SERIAL PRIMARY KEY,
  clinic_id     INT REFERENCES clinics(id),
  token_id      INT REFERENCES tokens(id),
  user_id       INT REFERENCES users(id),
  event_type    VARCHAR(50) NOT NULL,
  old_position  INT,
  new_position  INT,
  old_status    VARCHAR(30),
  new_status    VARCHAR(30),
  reason        TEXT,
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Doctor daily session snapshots (for fast report queries)
CREATE TABLE doctor_session_stats (
  id                  SERIAL PRIMARY KEY,
  doctor_id           INT REFERENCES doctors(id),
  clinic_id           INT REFERENCES clinics(id),
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

-- Notification log
CREATE TABLE notifications_log (
  id          SERIAL PRIMARY KEY,
  clinic_id   INT REFERENCES clinics(id),
  token_id    INT REFERENCES tokens(id),
  channel     VARCHAR(20) NOT NULL,   -- sms | email | push
  message     TEXT,
  status      VARCHAR(20) DEFAULT 'pending',
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_tokens_clinic_doctor_date ON tokens(clinic_id, doctor_id, joined_at::DATE);
CREATE INDEX idx_tokens_status ON tokens(status) WHERE status NOT IN ('completed','no_show');
CREATE INDEX idx_sub_patients_token ON sub_patients(token_id);
CREATE INDEX idx_queue_events_token ON queue_events(token_id);
CREATE INDEX idx_stats_doctor_date ON doctor_session_stats(doctor_id, session_date);

-- Row Level Security
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_events ENABLE ROW LEVEL SECURITY;
```

---

## 13. API Endpoints

### 13.1 Patient (Public)

| Method | Endpoint | Body / Params | Response |
|---|---|---|---|
| `POST` | `/api/queue/join` | `{ doctor_id, name, phone, type, sub_patients[] }` | `{ token_id, token_number, position, socket_room }` |
| `GET` | `/api/queue/status/:token_id` | — | `{ status, position, ahead, est_wait_min, sub_patients[] }` |
| `GET` | `/api/queue/display/:clinic_id/:doctor_id` | — | `{ current, last_3, threshold_remaining }` |
| `GET` | `/api/queue/threshold/:doctor_id` | — | `{ open, slots_remaining, session_end }` |
| `GET` | `/api/appointments/slots/:doctor_id/:date` | — | `{ slots[] }` |
| `POST` | `/api/appointments/book` | `{ doctor_id, date, time, name, phone, sub_patients[] }` | `{ appointment_id, token_number }` |
| `DELETE` | `/api/appointments/:id` | `?phone=verify` | `{ success }` |

### 13.2 Admin / Staff (JWT required)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/queue/:doctor_id` | Full live queue list |
| `POST` | `/api/admin/queue/call-next` | Advance to next token |
| `POST` | `/api/admin/queue/call/:token_id` | Call specific token |
| `PATCH` | `/api/admin/token/:id/present` | Mark physically present |
| `PATCH` | `/api/admin/token/:id/complete` | Mark consultation complete |
| `PATCH` | `/api/admin/token/:id/hold` | Place token on hold |
| `POST` | `/api/admin/token/:id/penalty` | Apply penalty |
| `POST` | `/api/admin/token/:id/noshow` | Mark no-show |
| `POST` | `/api/admin/token/emergency` | Insert emergency token |
| `POST` | `/api/admin/token/:id/requeue` | Re-queue patient |
| `PATCH` | `/api/admin/sub-patient/:id/status` | Update sub-patient status |
| `PATCH` | `/api/admin/threshold/:doctor_id` | Override threshold (admin) |
| `POST` | `/api/admin/queue/pause` | Pause/resume ticket generation |
| `POST` | `/api/admin/queue/reset` | Reset entire queue (end of day) |
| `GET` | `/api/admin/audit-log` | Filtered audit log |

### 13.3 Doctor Portal (JWT required, doctor role)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/doctor/dashboard` | Today's summary stats |
| `GET` | `/api/doctor/queue` | Read-only live queue |
| `PATCH` | `/api/doctor/threshold` | Update own threshold |
| `GET` | `/api/doctor/reports/daily/:date` | Daily report |
| `GET` | `/api/doctor/reports/weekly` | Last 7 days trends |
| `GET` | `/api/doctor/reports/monthly/:year/:month` | Monthly report |
| `GET` | `/api/doctor/reports/history` | Patient history (paginated) |
| `GET` | `/api/doctor/reports/export/pdf/:date` | Download daily PDF |
| `GET` | `/api/doctor/reports/export/csv/:date` | Download daily CSV |

---

## 14. Socket.IO Event Reference

### 14.1 Client → Server (Emitted by Frontend)

| Event | Payload | Description |
|---|---|---|
| `join:queue` | `{ clinicId, doctorId }` | Admin/doctor joins room for live queue |
| `join:patient` | `{ tokenId }` | Patient joins their personal status room |
| `join:display` | `{ clinicId, doctorId }` | Display screen joins broadcast room |

### 14.2 Server → Client (Broadcast by Backend)

| Event | Room | Payload | Trigger |
|---|---|---|---|
| `queue:updated` | `clinic:{id}:doctor:{id}:queue` | Full queue array | Any queue change |
| `token:called` | `clinic:{id}:doctor:{id}:queue` | `{ token_number, name }` | Call Next / Call Specific |
| `token:status` | `clinic:{id}:patient:{token_id}` | `{ status, position, ahead }` | Any status change |
| `threshold:update` | `clinic:{id}:doctor:{id}:queue` | `{ used, max, remaining }` | Token added/removed |
| `emergency:insert` | `clinic:{id}:doctor:{id}:queue` | `{ token_number, reason }` | Emergency triggered |
| `queue:paused` | `clinic:{id}:doctor:{id}:queue` | `{ paused: true/false }` | Admin pause toggle |
| `penalty:applied` | `clinic:{id}:patient:{token_id}` | `{ new_position, penalty_count }` | Penalty job fires |

---

## 15. System Flow Diagrams

### 15.1 Walk-in Patient with Multi-Patient + Threshold

```
Patient opens queue URL
         │
         ▼
[Redis] INCR clinic:{id}:doctor:{id}:threshold_count  ← atomic
         │
   ┌─────┴─────┐
count > max?  time outside window?
   │ YES            │ YES
   ▼                ▼
DECR (rollback)   Return 423
Return 429        "Session Closed"
"Slots Full"
   │
   │ NO → Continue
   ▼
Insert token + sub_patients in PostgreSQL (transaction)
         │
         ▼
Socket.IO emit → clinic:{id}:doctor:{id}:queue room
                 (all admins + display screen update)
         │
         ▼
SMS sent to patient with status link
         │
         ▼
[Admin] CALL NEXT button tap
         │
         ▼
token.status → "called"
Socket.IO emit → patient room + queue room
BullMQ: schedule penalty job (delay = grace_minutes)
         │
    ┌────┴────┐
Admin taps   Grace period
PRESENT?     expires?
    │YES          │YES
    ▼             ▼
Cancel BullMQ  Penalty job fires
job            DECR position by N
status →       Socket.IO broadcast
"present"      Twilio SMS sent
    │
    ▼
Doctor marks sub-patients one by one → "done"
    │
All done?
    │ YES
    ▼
token.status → "completed"
doctor_session_stats updated
Socket.IO emit → queue advances
```

### 15.2 Emergency Flow

```
Admin taps EMERGENCY (purple button)
         │
         ▼
EmergencyModal opens (bottom sheet on mobile)
Admin types reason (required)
Taps CONFIRM
         │
         ▼
POST /api/admin/token/emergency
         │
         ▼
[Redis] Atomic prepend: new token at position 0
All other tokens: position += 1
         │
         ▼
[PostgreSQL] INSERT emergency token
UPDATE all active tokens SET position = position + 1
         │
         ▼
Socket.IO broadcast:
  - queue:updated → all admin dashboards
  - All patient rooms → position count updated
  - Display screen → red EMERGENCY banner
         │
         ▼
Audit log entry inserted
```

---

## 16. Free Deployment Guide

### 16.1 Services Used (All Free Tier)

| Service | What For | Free Limit | Link |
|---|---|---|---|
| **Vercel** | React frontend | Unlimited deploys, 100GB bandwidth | vercel.com |
| **Railway** | Node.js API | $5 free credit/mo (~500 hrs) | railway.app |
| **Supabase** | PostgreSQL database | 500MB storage, unlimited API calls | supabase.com |
| **Upstash** | Redis (BullMQ + Socket.IO adapter) | 10,000 commands/day | upstash.com |
| **Twilio** | SMS | $15 free trial credit | twilio.com |
| **SendGrid** | Email (reports, reminders) | 100 emails/day free forever | sendgrid.com |
| **GitHub** | Source control + CI/CD | Free | github.com |

### 16.2 Step-by-Step Deployment

#### Step 1 — Database (Supabase)
```bash
# 1. Create project at supabase.com
# 2. Get connection string from Settings > Database
# 3. Run migrations
DATABASE_URL=postgresql://... npx node-pg-migrate up
# 4. Enable RLS on tables in Supabase dashboard
```

#### Step 2 — Redis (Upstash)
```bash
# 1. Create Redis database at upstash.com
# 2. Copy REDIS_URL (rediss://... format)
# 3. Add to Railway environment variables
```

#### Step 3 — Backend (Railway)
```bash
# 1. Connect GitHub repo to Railway
# 2. Set root directory to /server
# 3. Add environment variables:
DATABASE_URL=postgresql://...        # from Supabase
REDIS_URL=rediss://...               # from Upstash
JWT_SECRET=your-256-bit-secret
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
CLIENT_URL=https://your-app.vercel.app
NODE_ENV=production
PORT=3001
# 4. Railway auto-detects Node.js and deploys
```

#### Step 4 — Frontend (Vercel)
```bash
# 1. Connect GitHub repo to Vercel
# 2. Set root directory to /client
# 3. Add environment variables:
VITE_API_URL=https://your-api.railway.app
VITE_SOCKET_URL=https://your-api.railway.app
# 4. Vercel auto-builds with `npm run build`
```

#### Step 5 — Custom Domain (Optional, Free on Vercel)
```
queue.yourclinic.com    → Vercel (patient + admin frontend)
api.yourclinic.com      → Railway (proxy via custom domain)
```

### 16.3 Scaling Beyond Free Tier

| When | Action | Cost |
|---|---|---|
| > 500 concurrent users | Railway Pro | ~$20/mo |
| > 500MB database | Supabase Pro | $25/mo |
| > 10,000 Redis ops/day | Upstash Pay-as-you-go | ~$0.20 per 100k ops |
| > 5 Node processes needed | Add `@socket.io/redis-adapter` (already in stack) | Just add Railway instances |
| > 1000 SMS/month | Twilio paid | ~$0.0075/SMS |

---

## 17. Checkpoints & Milestones

| Phase | Milestone | Duration | Deliverables |
|---|---|---|---|
| 0 | Project Setup | Week 1 | GitHub repo, Supabase DB, Railway + Vercel configured, env vars, PostgreSQL migrations, RLS policies |
| 1 | Core Queue Engine | Weeks 2–3 | Token model, state machine, walk-in API, Socket.IO rooms, basic call-next, Redis threshold counter |
| 2 | Patient-Facing UI | Weeks 3–4 | Queue join page, live status page (Socket.IO), public display board, mobile-first responsive |
| 3 | Game-Style Admin Dashboard | Weeks 4–5 | ActionButton component, hold-to-confirm, NowServingCard, ThresholdMeter, QueueBottomSheet, haptic feedback |
| 4 | Online Appointments | Weeks 5–6 | Booking flow, slot availability, walk-in/online interleaving, SMS reminders via BullMQ |
| 5 | Threshold System | Week 6 | Redis INCR atomic check, session time validation, threshold UI states, kiosk FULL state |
| 6 | Multi-Patient Tickets | Weeks 6–7 | Sub-patient model, companion form, doctor expanded card, per-sub status, threshold deduction |
| 7 | Penalty System | Week 7 | BullMQ delayed penalty jobs, cancel-on-present, position reorder, SMS, auto no-show |
| 8 | Emergency Override | Week 7 | Emergency button, reason modal, atomic queue prepend, broadcast, audit log |
| 9 | Doctor Portal & Reports | Weeks 7–8 | Doctor login, dashboard stats, daily/weekly/monthly reports, Recharts, PDF export via Puppeteer |
| 10 | Notifications | Week 8 | Full SMS (Twilio), email (SendGrid), in-app Socket.IO alerts, notification log |
| 11 | Security Hardening | Week 8–9 | 2FA (TOTP), rate limiting, Helmet.js, RLS audit, RBAC review, penetration checklist |
| 12 | Multi-Tenant QA | Week 9 | Cross-clinic data isolation tests, concurrent threshold tests, load test with k6 |
| 13 | Testing & QA | Week 9 | Jest unit tests, Playwright E2E, k6 load test (500 concurrent), OWASP ZAP scan |
| 14 | Pilot Deployment | Week 10 | Deploy to production, onboard 2–3 pilot clinics, staff + doctor training, 2-week monitored run |

---

## 18. Proof of Concept (POC) Plan

### 18.1 POC Goals

Validate the 5 riskiest technical assumptions in 2 weeks:

1. Socket.IO real-time delivery works at clinic scale on Railway free tier.
2. Redis INCR threshold check has zero race conditions under 100 concurrent requests.
3. Multi-patient sub-count correctly deducts from threshold in all edge cases.
4. BullMQ penalty timer fires accurately and cancels correctly when patient arrives.
5. Game-style UI buttons work flawlessly on a real mobile device (Android + iOS).

### 18.2 POC Features

- 1 clinic, 1 doctor setup.
- Walk-in token with up to 2 companions.
- Doctor threshold set to 10 max.
- Game dashboard: Call Next, Mark Present, Penalty, No-Show, Complete.
- Live display board via Socket.IO.
- Doctor portal: today's count + avg time card.
- 1 SMS on token call (Twilio trial).

### 18.3 POC Success Criteria

| Test | Pass Criteria |
|---|---|
| Socket.IO latency | Queue update on patient screen < 500ms after admin action |
| Threshold race condition | 100 concurrent POST /queue/join: exactly 10 tokens created, 90 rejected |
| Multi-patient threshold | 3-person ticket: threshold counter decremented by 3 (verified in DB + Redis) |
| Penalty timer | BullMQ job fires at exactly grace_period ± 5s; cancels when Present clicked |
| Doctor report accuracy | Completed count = SUM(sub_patients where status=done) for today |
| Mobile game UI | 20 patients processed on real Android phone without UI error or mis-click |
| Hold-to-confirm | Penalty / No-Show only triggers after 1.5s hold; single tap does nothing |

### 18.4 POC 2-Week Sprint

| Days | Work |
|---|---|
| 1–2 | Supabase setup, migrations, Railway deploy, environment config |
| 3–4 | Token API, Redis threshold, Socket.IO rooms, basic queue logic |
| 5–6 | Patient join page, live status, WebSocket hook in React |
| 7–8 | Game dashboard (ActionButton, hold-to-confirm, NowServingCard) |
| 9–10 | BullMQ penalty jobs, multi-patient form + sub-patient tracking |
| 11–12 | Doctor portal (today stats), threshold meter, SMS integration |
| 13–14 | Concurrency tests, bug fixes, mobile device testing, demo |

---

## 19. Dev Team & Cost Estimates ★

### 19.1 Recommended Team

| Role | Responsibility | Engagement |
|---|---|---|
| **Full-Stack Lead** (Node.js + React) | Core queue engine, Socket.IO, APIs, game UI | Full-time |
| **Frontend Developer** (React + Tailwind) | Patient UI, doctor portal, charts, responsive | Full-time |
| **Backend Developer** (Node.js + PostgreSQL) | DB design, BullMQ jobs, reports, multi-tenant | Full-time |
| **QA Engineer** | Testing (Jest, Playwright, k6), security scan | Part-time (50%) |
| **UI/UX Designer** (optional) | Game dashboard mockups, design tokens | Part-time (25%) |
| **DevOps** (optional) | CI/CD, monitoring, scaling setup | Part-time (10%) |

> Minimum viable team: **2 full-stack developers** can build the full MVP in 12–14 weeks.

### 19.2 Development Cost Estimates

#### Option A — In-House Team (Hiring)

| Role | Monthly Rate (PKR) | Monthly Rate (USD) | Duration | Total (USD) |
|---|---|---|---|---|
| Full-Stack Lead | PKR 150,000–250,000 | $500–900 | 3 months | $1,500–2,700 |
| Frontend Dev | PKR 100,000–180,000 | $350–650 | 3 months | $1,050–1,950 |
| Backend Dev | PKR 100,000–180,000 | $350–650 | 3 months | $1,050–1,950 |
| QA (part-time) | PKR 50,000–80,000 | $175–280 | 3 months | $525–840 |
| **Total In-House** | | | | **$4,125–7,440** |

#### Option B — Freelancer / Agency (Upwork / Local)

| Package | Scope | Estimate (USD) |
|---|---|---|
| POC only (2 weeks) | Core queue + game UI + Socket.IO | $800–1,500 |
| MVP (Phase 0–8) | Full system, no reports, no analytics | $3,000–5,000 |
| Full v3.0 (Phase 0–14) | Everything in this spec | $6,000–10,000 |
| Premium agency (USA/EU) | Full spec + dedicated PM | $25,000–50,000 |

#### Option C — Solo Developer (If You Know JS)

| Item | Time | Cost |
|---|---|---|
| Core queue engine | 3 weeks | Your time |
| Game UI (React) | 2 weeks | Your time |
| Reports + doctor portal | 2 weeks | Your time |
| Infrastructure | 1 week | Your time |
| **Total solo** | **~8 weeks** | **$0 dev + infra below** |

### 19.3 Infrastructure Cost at Scale

| Scale | Monthly Cost |
|---|---|
| 0–3 clinics (free tier) | **$0/month** |
| 4–10 clinics (light load) | **$25–50/month** (Railway Pro + Supabase Pro) |
| 10–50 clinics (medium load) | **$80–150/month** |
| 50–200 clinics (SaaS scale) | **$300–600/month** (multiple Railway instances + Redis scale) |
| 200+ clinics | Custom VPS/Kubernetes; $1,000–2,000/month |

### 19.4 Time-to-Market Summary

| Target | Timeline | Team Size |
|---|---|---|
| POC / Demo | 2 weeks | 1–2 devs |
| MVP (1 clinic, basic features) | 6 weeks | 2 devs |
| Production v1 (full spec) | 10 weeks | 3 devs |
| Multi-clinic SaaS launch | 14 weeks | 3–4 devs |

---

## 20. Future Enhancements

| Feature | Priority | Tech Notes |
|---|---|---|
| **Mobile App (iOS/Android)** | High | React Native reuses all existing React components + same API |
| **WhatsApp Business API** | High | Patient replies "HERE" to confirm presence; Twilio WhatsApp add-on |
| **AI Wait-Time Prediction** | Medium | Python microservice (your team knows Python!); trained on `doctor_session_stats` |
| **Biometric / QR Check-in** | Medium | QR in SMS → patient scans at kiosk to self-confirm; `html5-qrcode` library |
| **Multi-Doctor Smart Routing** | Medium | Patient picks specialty; algorithm routes to shortest-queue eligible doctor |
| **Doctor-to-Doctor Referral** | Medium | Doctor sends patient to another doctor's queue from portal with one tap |
| **Telemedicine Queue** | Low | WebRTC video call slot in queue; integrate Daily.co or Twilio Video |
| **Insurance Verification** | Low | API call to insurer at check-in; auto-pull coverage status |
| **Voice Admin Commands** | Low | Web Speech API: say "Call next" hands-free for single-doctor offices |
| **Analytics SaaS Dashboard** | Low | Super Admin cross-clinic performance comparison; Recharts + PostgreSQL aggregations |
| **Offline PWA Mode** | Low | Service Worker + IndexedDB; queue still works if internet drops briefly |
| **Python Analytics Service** | Medium | Separate FastAPI service for heavy ML/reporting; your team already knows Python |

---

*End of Document — MediQueue Pro SRS v3.0*
*Stack: Node.js · React · Socket.IO · PostgreSQL · Redis (BullMQ) · Vercel · Railway · Supabase*
*Scale: Multi-tenant, 10+ clinics from day 1 · Free to launch · $0 infrastructure to start*