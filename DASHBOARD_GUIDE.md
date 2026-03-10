# MediQueue Pro — Admin Dashboard Feature Guide

This file explains every feature on the **Game-Style Admin Dashboard** (`/admin`).

---

## Layout Overview

```
┌──────────────────────────────────────────────────┐
│  STATUS BAR        (top — logged-in user + pause) │
├──────────────────────────────────────────────────┤
│  THRESHOLD METER   (capacity bar)                 │
├──────────────────────────────────────────────────┤
│  NOW SERVING CARD  (current patient + timer)      │
├──────────────────────────────────────────────────┤
│  NEXT UP STRIP     (preview of next 3 tokens)     │
├──────────────────────────────────────────────────┤
│  ACTION BUTTONS    (2×4 grid — main controls)     │
├──────────────────────────────────────────────────┤
│  QUEUE BOTTOM SHEET (swipe up = full list)        │
└──────────────────────────────────────────────────┘
```

---

## 🟢 CALL NEXT — Green

**How to use:** Single tap  
**What it does:**
- Advances the queue to the **next Waiting token** (Emergency tokens jump to the front automatically).
- Sets token status → `called`.  
- Starts a **grace period countdown** (default: 5 minutes). If the patient doesn't arrive within the grace period, a penalty is applied automatically.
- Broadcasts a live update via **Socket.IO** to:
  - All admin screens  
  - The patient's own status page  
  - The waiting room display board

> **Tip:** Always tap CALL NEXT after marking the previous patient as COMPLETE so the queue advances in order.

---

## 🔵 PRESENT (Mark Present) — Blue

**How to use:** Single tap (only active when a token is currently called)  
**What it does:**
- Confirms the patient has **physically arrived** at the counter.
- Sets token status → `present`.
- **Cancels the penalty grace timer** — the patient will not be penalized.
- Updates the patient's live status page instantly.

> **Tip:** Tap PRESENT as soon as the patient walks up so the penalty timer doesn't fire by accident.

---

## 🩵 RE-CALL — Teal

**How to use:** Single tap  
**What it does:**
- **Re-announces the current token** without changing its position or status.
- Triggers an audio announcement on the **Display Board** (if Web Speech API is enabled in the browser).
- Useful when a patient didn't hear the first call.

---

## 🟠 ON HOLD — Orange

**How to use:** Single tap (token must be active)  
**What it does:**
- Moves the current token to **On Hold** status.
- The token stays in the queue but is skipped when CALL NEXT is pressed.
- Useful when a patient says "give me 2 more minutes."
- Admin can resume the token by calling it specifically from the queue list.

---

## 🟡 PENALTY — Amber/Yellow

**How to use:** **Hold for 1.5 seconds** (hold-to-confirm — prevents accidental taps)  
**A progress ring fills** while you hold. Release early = nothing happens.  
**What it does:**
- Manually applies a **penalty** to the currently called patient.
- Moves their token **back N positions** in the queue (default: 2 positions).
- Sets status → `penalized`.
- Sends an **SMS** to the patient notifying their new position (if Twilio is set up).
- If a patient has already been penalized **3 times**, they are automatically marked **No-Show**.

> **Use when:** Patient was called, didn't show up, but you want to give them another chance further back in the queue.

---

## 🔴 NO-SHOW — Red

**How to use:** **Hold for 1.5 seconds** (hold-to-confirm — prevents accidental taps)  
**What it does:**
- **Removes the token from the active queue** entirely.
- Sets status → `no_show`.
- Records the no-show in the **doctor's daily stats** (no-show count).
- Sends an **SMS** to the patient.
- Cannot be undone from the dashboard (admin must contact reception to re-queue).

> **Use when:** You are certain the patient has left and will not return for today's session.

---

## 🟣 EMERGENCY — Purple (pulsing when active)

**How to use:** Single tap → fills in a **reason modal** → tap CONFIRM  
**What it does:**
- Opens a **modal with a required reason field** (e.g., "Cardiac arrest", "High fever child").
- Inserts a new token at **position #1** — front of the queue.
- All other patients shift back by 1 position and their status pages update instantly.
- The **Display Board** shows a red pulsing `⚡ EMERGENCY` banner.
- Bypasses the threshold limit (uses reserved buffer slots).
- Logs a full **audit entry**: admin name, reason, timestamp, IP address.
- The button **pulses** if an emergency is currently being served.

> **Important:** A reason is mandatory — the modal will not let you confirm without typing one.

---

## 🌲 COMPLETE — Dark Green

**How to use:** Single tap (only active when a patient is present/in consultation)  
**What it does:**
- Marks the current token as **Completed** — the consultation is done.
- If the token has **companion patients** (multi-patient ticket), you should mark each companion as `done` individually from the bottom sheet before marking the master token complete.
- Records the completion in **Doctor Session Stats** (total seen, consultation time).
- Advances the queue — the next token is ready to be called.
- Updates the doctor's **daily report** immediately.

---

## Secondary Dashboard Features

---

### 📊 Threshold Meter (Capacity Bar)

Located just below the status bar.

| Colour | Meaning |
|--------|---------|
| 🟢 Green | < 70% full — plenty of slots |
| 🟡 Yellow | 70–90% full — filling up |
| 🔴 Red | ≥ 90% full — near capacity |
| FULL | 100% — no new tickets accepted |

The counter shows **X / Y slots used** and **"N left"**. Updates live as new patients join.

---

### 🪪 Now Serving Card

Always pinned at the top. Shows:
- **Token number** in large font (e.g., `B-042`)
- **Patient name**
- A badge if the ticket covers **multiple patients** (e.g., "3 patients")
- **Elapsed timer** counting up from when the token was called — helps track long consultations.

---

### ⏭ Next Up Strip

A horizontal scroll row showing the **next 3 waiting tokens** as preview cards.  
Each card shows: queue position, token number, and patient first name.  
Useful for the receptionist to call patients over before they're officially called.

---

### 📋 Queue Bottom Sheet (Swipe Up)

- Tap the handle bar at the bottom to **expand the full queue list**.
- Shows all active tokens with their current status and colour-coded badges.
- Tap again to collapse.
- Multi-patient tokens show a companion count next to the token number.

---

### ⏸ Queue Pause Toggle

Located in the **Status Bar** (top right).  
- **Pause** → stops new walk-in tickets from being generated; existing queue continues.  
- An orange `⏸ PAUSED` banner appears when paused.  
- Tap **Resume** to re-open ticket generation.  
- Useful during lunch breaks or when the doctor is temporarily unavailable.

---

## Token Status Flow

```
                    ┌─────────┐
Patient joins  ───► │ WAITING │
                    └────┬────┘
                         │ CALL NEXT
                    ┌────▼────┐
                    │ CALLED  │ ◄── grace timer starts
                    └────┬────┘
             ┌───────────┼────────────────┐
             │ PRESENT   │ grace expires   │ PENALTY
        ┌────▼─────┐    ┌▼──────────┐  ┌──▼────────┐
        │ PRESENT  │    │ PENALIZED │  │ PENALIZED │
        └────┬─────┘    └───────────┘  └───────────┘
             │ COMPLETE
        ┌────▼──────┐
        │ COMPLETED │  ──► doctor stats updated
        └───────────┘

At any point admin can:
  ON HOLD   → status = on_hold (skipped by CALL NEXT)
  NO-SHOW   → status = no_show (removed from queue)
  EMERGENCY → new token inserted at position 0
```

---

## Multi-Patient Tickets (Companions)

When a patient checks in with family members on one token:
- The token counts as **N slots** (1 per person) against the threshold.
- The token label shows: `B-042 · Ali, Sara, Ahmed (3 patients)`.
- Doctor marks each companion **individually** (waiting → in_consultation → done).
- The master token is only marked `completed` when **all companions are done**.
- On the bottom sheet, expand a token to see each companion's sub-status.

---

## Keyboard / Quick Reference

| Action | Input |
|--------|-------|
| Call Next | Single tap (green) |
| Mark Present | Single tap (blue) |
| Re-Call | Single tap (teal) |
| On Hold | Single tap (orange) |
| Penalty | **Hold 1.5s** (yellow) |
| No-Show | **Hold 1.5s** (red) |
| Emergency | Tap → fill reason → confirm (purple) |
| Complete | Single tap (dark green) |
| Expand Queue | Tap bottom handle bar |
| Pause / Resume | Tap toggle in status bar |
