# AI Call Center Concierge — MVP PRD + Design/Architecture (13-hour, $0 Demo)

> **Scope note (critical):** A true PSTN phone-number call center usually costs money (Twilio/SignalWire/etc.).  
> This MVP demos the *call-center experience* using **voice-in-web** (optional) and a **tel: handoff** for “call transfer,” while delivering the full booking/scheduling/goals/budgeting dashboard experience.

---

## 1) Product Requirements Document (PRD)

### 1.1 Product name
**AI Call Center Concierge** (working title)

### 1.2 Goal
A voice-first AI “call center” that helps users:
1) **Book** restaurants/businesses (with “transfer” handoff)  
2) **Schedule** events/activities and add them to calendar  
3) **Track goals** and generate activity plans  
4) **Send reminders** (web push)  
5) **Track budgets/expenses** and alert when low  

### 1.3 Target demo scenario (what judges should see)
1. User clicks **Call AI Agent** (voice or chat).  
2. Says: “Book dinner at The Library tomorrow at 7pm for 2.”  
3. Agent collects missing info → confirms → creates **Booking**.  
4. Agent offers “Transfer to restaurant” → user clicks **Call now** (tel link).  
5. User returns and says “Confirmed.”  
6. App generates **calendar event (.ics download)** + shows **Upcoming bookings**.  
7. User says: “My goal is to run 3x/week. Fit it into my schedule.”  
   Agent generates recurring activities → dashboard shows streak plan.  
8. User says: “Set food budget $60/week; add $18 Chipotle.”  
   Dashboard shows remaining balance + low-budget alert.

### 1.4 MVP scope (must-have)
- **User account (simple auth):** email/password or “demo login”
- **Sessions:** each call/chat stored with transcript + AI summary
- **Booking:** create + status + “transfer” handoff + calendar entry
- **Scheduling:** create activities/events + optional recurrence + calendar entry
- **Goal tracking:** create goal → AI proposes plan (activities)
- **Reminders:** web push notifications for upcoming activities and low budget
- **Budgeting:** budget limit + expenses + remaining balance

### 1.5 Out of scope (for 13 hours)
- Real PSTN phone number + real outbound calling (paid)
- Real SMS texting (paid)
- Full Google Calendar OAuth integration (MVP uses **.ics** export; add later)

### 1.6 Non-functional requirements
- Demo reliability > perfection
- AI outputs must be structured (JSON actions) to avoid chaotic behavior
- Local dev run: `docker compose up` or `npm run dev` + `api start`

### 1.7 Success criteria
- End-to-end demo completes in **3–5 minutes**
- **~90%** of commands route to correct module
- Dashboard updates instantly after actions
- Reminders visibly fire (push toast)

---

## 2) Design Document (Architecture + Implementation Plan)

### 2.1 High-level architecture
**Web App (Next.js)**  
↕ (REST/JSON)  
**API Server (FastAPI or Node/Express)**  
- Auth
- DB CRUD
- Notification scheduler
- Calendar (.ics generation)
- AI Orchestrator (“tool calling” via JSON)

**Database:** SQLite (fast, $0, ideal for demo)

**Voice pipeline (optional but recommended):**
- Browser mic → API `/voice/transcribe` → `whisper.cpp`
- API → AI Orchestrator → text reply
- API `/voice/speak` → Piper TTS → audio stream back

### 2.2 Two viable MVP paths
**MVP Path A (recommended): “Call center” = voice call inside the web app (fast, free)**  
- Free local/self-hosted:
  - STT: `whisper.cpp`
  - TTS: Piper  
- “Call transfer” = **tel:** handoff + confirmation in-app.

**MVP Path B (riskier in 13 hours): local VoIP PBX simulation**  
- Asterisk + SIP.js / WebRTC extensions (not PSTN)  
- Closer “transfer” feel, higher integration risk.

### 2.3 System components

#### A) Frontend (Next.js)
**Pages**
1. `/login` (or `/demo`)
2. `/dashboard`
   - Sessions list + details
   - Upcoming bookings
   - Upcoming activities
   - Goal tracker / streaks
   - Budget overview (limit, expenses, remaining)
3. `/call` (Call AI Agent)
   - Chat mode (text) **MUST**
   - Voice mode **OPTIONAL** (if time)
4. `/settings`
   - Notification opt-in
   - Timezone
   - Default availability (optional)

**Frontend modules**
- `SessionPanel`
- `BookingPanel`
- `ActivityPanel`
- `GoalPanel`
- `BudgetPanel`
- `NotificationOptIn`

**UI behavior**
- After each user message: `POST /ai/execute` returns
  - `assistant_message` (for chat)
  - `actions_executed[]`
  - updated `dashboard_snapshot`

#### B) Backend (FastAPI or Express)
Services (logical modules):
1. Auth Service
2. AI Orchestrator
3. Booking Service
4. Scheduling Service
5. Goal Service
6. Budget Service
7. Notification Service
8. Calendar Service (.ics)

### 2.4 Why this is feasible in 13 hours
- One frontend + one backend + one DB.
- AI = **command parser** returning JSON actions.
- Calendar = **.ics export** instead of OAuth.
- Notifications = **Web Push** instead of SMS.

---

## 3) AI Orchestrator (Core of MVP)

### 3.1 Key idea
AI returns **strict JSON actions** only.

### 3.2 Input
- User text
- Recent session context (last N turns)
- User profile (timezone, preferences)
- Optional: upcoming activities/bookings for smarter suggestions

### 3.3 Output contract
- `assistant_message` (human-friendly)
- `actions[]`: list of typed actions with validated params
- `missing_fields[]`: if clarification is needed

### 3.4 Action types (MVP)
- `CREATE_BOOKING`
- `CONFIRM_BOOKING`
- `CREATE_ACTIVITY`
- `CREATE_GOAL`
- `GENERATE_GOAL_PLAN` (returns activities)
- `SET_BUDGET`
- `ADD_EXPENSE`
- `CREATE_REMINDER`
- `EXPORT_CALENDAR_EVENT` (or create event and allow download)

### 3.5 Example output
```json
{
  "assistant_message": "Got it. Booking dinner tomorrow at 7pm for 2 at The Library. Want me to create it and prepare a transfer call?",
  "missing_fields": [],
  "actions": [
    {
      "type": "CREATE_BOOKING",
      "payload": {
        "business_name": "The Library",
        "datetime_local": "2026-02-08T19:00:00",
        "party_size": 2,
        "notes": "Dinner reservation"
      }
    }
  ]
}
```

### 3.6 Hard rule (stability)
If required info is missing, the AI must ask a question and return **no actions**.

---

## 4) Data Model (Schemas)

> Implement with **Prisma + SQLite** (if Next.js) or **SQLAlchemy + SQLite** (if FastAPI).  
> Below is the logical model.

### 4.1 Users
- `id` (uuid)
- `email`
- `password_hash` (or demo mode)
- `timezone` (default: browser tz)
- `created_at`

### 4.2 Sessions
- `id`
- `user_id`
- `channel` (VOICE|CHAT)
- `started_at`, `ended_at`
- `summary` (AI-generated)
- `transcript` (text)
- `intent_tags` (json/string)

### 4.3 Bookings
- `id`
- `user_id`
- `session_id`
- `business_name`
- `business_phone` (optional)
- `datetime_local`
- `party_size`
- `status` (DRAFT|PENDING_CONFIRMATION|CONFIRMED|CANCELLED)
- `calendar_event_id` (nullable)
- `created_at`

### 4.4 Activities
- `id`
- `user_id`
- `session_id`
- `title`
- `datetime_local`
- `duration_min`
- `recurrence_rule` (string like `WEEKLY;BYDAY=MO,WE,FR`)
- `status` (PLANNED|DONE|SKIPPED)
- `goal_id` (nullable)
- `calendar_event_id` (nullable)

### 4.5 Goals
- `id`
- `user_id`
- `title`
- `metric` (e.g., “runs/week”)
- `target_value`
- `frequency` (WEEKLY|BIWEEKLY|MONTHLY)
- `streak_count`
- `created_at`

### 4.6 Budgets
- `id`
- `user_id`
- `category` (FOOD|FUN|GENERAL)
- `period` (WEEKLY|MONTHLY)
- `limit_amount`
- `start_date`
- `remaining_amount` (can be derived; storing helps speed)

### 4.7 Expenses
- `id`
- `user_id`
- `budget_id`
- `amount`
- `merchant`
- `datetime_local`
- `note`

### 4.8 Notifications
- `id`
- `user_id`
- `type` (UPCOMING_ACTIVITY|LOW_BUDGET|BOOKING_REMINDER)
- `payload` (json)
- `scheduled_for`
- `sent_at` (nullable)
- `status` (SCHEDULED|SENT|FAILED)

### 4.9 PushSubscriptions (Web Push)
- `id`
- `user_id`
- `endpoint`
- `p256dh`
- `auth`
- `created_at`

---

## 5) API Endpoints (Minimal Set)

### 5.1 Auth
- `POST /auth/login`
- `POST /auth/demo` *(optional for fastest demo)*

### 5.2 Dashboard
- `GET /dashboard` → sessions + upcoming bookings + upcoming activities + goals + budget snapshot

### 5.3 Sessions
- `POST /sessions/start`
- `POST /sessions/{id}/append` *(store user msg + assistant msg)*
- `POST /sessions/{id}/end`

### 5.4 AI
- `POST /ai/interpret` → returns JSON action plan (no DB changes) *(optional)*
- `POST /ai/execute` → interpret + execute actions + return updated snapshot  
  *(MVP can combine interpret+execute into one endpoint)*

### 5.5 Bookings
- `POST /bookings`
- `PATCH /bookings/{id}` *(confirm/cancel)*
- `GET /bookings/upcoming`

### 5.6 Activities
- `POST /activities`
- `PATCH /activities/{id}` *(mark done)*
- `GET /activities/upcoming`

### 5.7 Goals
- `POST /goals`
- `POST /goals/{id}/plan` *(generates activities)*

### 5.8 Budget
- `POST /budgets`
- `POST /expenses`
- `GET /budgets/current`

### 5.9 Calendar
- `GET /calendar/event/{id}.ics` *(download)*

### 5.10 Notifications
- `POST /push/subscribe`
- `POST /notify/test`

---

## 6) Core Workflows (Sequence)

### 6.1 Booking flow
1. User: “Book dinner tomorrow at 7”
2. AI: missing fields? (party size, restaurant) → ask
3. AI returns `CREATE_BOOKING` (status DRAFT)
4. UI shows booking card + **Transfer call** button
5. Transfer button:
   - `tel:+1...` (or shows number)
6. User: “Confirmed”
7. AI returns `CONFIRM_BOOKING` + `EXPORT_CALENDAR_EVENT`
8. Dashboard shows upcoming booking

### 6.2 Scheduling / activities
1. User: “Schedule study session Wed 4pm”
2. AI → `CREATE_ACTIVITY`
3. If recurring: set `recurrence_rule`
4. Optional reminders auto-created

### 6.3 Goal plan flow
1. User: “Goal: run 3x/week”
2. AI → `CREATE_GOAL` + `GENERATE_GOAL_PLAN`
3. Plan chooses times using availability (or defaults)
4. Creates activities tied to goal
5. Streak computed from completions

### 6.4 Budgeting flow
1. “Set food budget $60/week”
2. `SET_BUDGET`
3. “Add $18 Chipotle”
4. `ADD_EXPENSE` → remaining updates
5. If remaining below threshold (e.g., 20%) schedule `LOW_BUDGET` notification

---

## 7) Notifications (Free)

### 7.1 Web Push (PWA)
- User opts in on `/settings`
- Store subscription in DB
- Scheduler checks:
  - activities starting within X minutes
  - budget remaining below threshold
- Sends push notification

**If time is tight:** implement only
- “Test notification” button + 1 scheduled reminder

---

## 8) Team Plan (A / B / C)

### Person A — Voice / Call Experience (and session UX)
**Deliverables**
- `/call` page chat working
- Optional voice:
  - mic capture → `/voice/transcribe`
  - play TTS audio for assistant response
- “Call transfer” button (`tel:`) on booking card

**Definition of done**
- Demo “call” in browser feels like a call center.

### Person B — Backend + DB + AI actions
**Deliverables**
- DB migrations + models
- `/ai/execute` endpoint with strict action schema validation
- Services that execute actions + return updated snapshot
- `.ics` generation endpoint

**Definition of done**
- Text commands reliably create bookings/activities/budgets.

### Person C — Dashboard + Notifications
**Deliverables**
- `/dashboard` UI (sessions, upcoming, goals, budget)
- `/settings` push opt-in
- Minimal push send endpoint + scheduler job

**Definition of done**
- Dashboard reflects everything and reminders pop.

---

## 9) 13-hour Build Schedule (Practical)
1. **Hour 0–1:** Repo setup, DB schema, routes skeleton  
2. **Hour 1–4:** AI action executor + bookings/activities/budget CRUD  
3. **Hour 4–6:** Dashboard UI + sessions list + upcoming lists  
4. **Hour 6–8:** Goal plan creation (simple heuristic) + streak logic  
5. **Hour 8–10:** Calendar `.ics` export + confirmation flow  
6. **Hour 10–12:** Push notifications + reminders  
7. **Hour 12–13:** Voice (if time) + demo script polish  

---

## 10) Time-saving Shortcuts (Highly Recommended)
- Build **text chat first**, add voice last
- Calendar: **.ics download** is 10x easier than Google OAuth
- Transfer: `tel:` link + “Confirmed?” step is enough
- Goal planning: simple heuristic:
  - choose weekdays at 6pm unless user specifies otherwise

---

## 11) Demo Script (Print This)
1) “Book dinner tomorrow 7pm, 2 people, The Library”  
2) Click “Transfer” → show tel number  
3) “Confirmed” → download calendar event  
4) “Goal: run 3 times/week” → plan created  
5) “Set food budget 60/week; add 18 Chipotle” → low budget warning + push test  

---
