# Person B Backend Implementation Roadmap

## Overview
**Role:** Backend + Database + AI Actions  
**Tech Stack:** Node.js, Express, Prisma, SQLite, OpenAI API  
**Timeline:** 10 hours (of 13-hour hackathon)

---

## Phase 1: Database Foundation (Hour 0-1)

### Tasks
- [ ] Expand `apps/api/prisma/schema.prisma` with 8 models:
  - Sessions (call/chat records)
  - Bookings (restaurant reservations)
  - Activities (scheduled events)
  - Goals (user objectives)
  - Budgets (spending limits)
  - Expenses (transactions)
  - Notifications (reminders)
  - PushSubscriptions (web push endpoints)
- [ ] Run migrations: `npx prisma migrate dev --name init_all_models`
- [ ] Generate client: `npx prisma generate`

### Definition of Done
✅ All tables created in SQLite  
✅ Prisma Client updated with new models

---

## Phase 2: Auth + Basic Endpoints (Hour 1-2)

### Tasks
- [ ] Create `src/middleware/auth.ts` (JWT validation)
- [ ] Build `src/services/auth.service.ts` (bcrypt + JWT)
- [ ] Add routes to `src/index.ts`:
  - `POST /auth/login`
  - `POST /auth/demo`

### Definition of Done
✅ Users can login and get JWT token  
✅ Protected routes verify tokens

---

## Phase 3: AI Orchestrator Core (Hour 2-4)

### Tasks
- [ ] Install OpenAI: `npm install openai`
- [ ] Create `src/services/ai.orchestrator.ts`:
  - Parse natural language → JSON actions
  - Use OpenAI function calling for structured output
  - Validate action schemas
  - Ask for missing fields (no incomplete actions)
- [ ] Build action executor (maps action types → service calls)
- [ ] Add route: `POST /ai/execute`

### Action Types
- `CREATE_BOOKING`
- `CONFIRM_BOOKING`
- `CREATE_ACTIVITY`
- `CREATE_GOAL`
- `GENERATE_GOAL_PLAN`
- `SET_BUDGET`
- `ADD_EXPENSE`
- `CREATE_REMINDER`
- `EXPORT_CALENDAR_EVENT`

### Definition of Done
✅ "Book dinner tomorrow 7pm for 2 at The Library" → creates booking  
✅ Missing info triggers clarifying questions, not errors  
✅ Returns structured JSON: `{ assistantMessage, missingFields, actions }`

---

## Phase 4: Business Services (Hour 4-7)

### 4A: BookingService (`src/services/booking.service.ts`)
- [ ] `createBooking(userId, data)` → Booking
- [ ] `confirmBooking(bookingId)` → Update status
- [ ] `cancelBooking(bookingId)` → Update status
- [ ] `getUpcoming(userId)` → Booking[]
- [ ] Add routes: `POST /bookings`, `PATCH /bookings/:id`, `GET /bookings/upcoming`

### 4B: SchedulingService (`src/services/scheduling.service.ts`)
- [ ] `createActivity(userId, data)` → Activity
- [ ] `markDone(activityId)` → Update status
- [ ] `getUpcoming(userId)` → Activity[]
- [ ] Parse recurrence rules (e.g., "WEEKLY;BYDAY=MO,WE,FR")
- [ ] Add routes: `POST /activities`, `PATCH /activities/:id`, `GET /activities/upcoming`

### 4C: GoalService (`src/services/goal.service.ts`)
- [ ] `createGoal(userId, data)` → Goal
- [ ] `generateGoalPlan(goalId)` → Activity[]
  - **Heuristic:** Default to Mon/Wed/Fri at 6pm for 3x/week goals
  - Check existing activities to avoid conflicts (optional)
- [ ] `updateStreak(goalId)` → Increment when activities marked done
- [ ] Add routes: `POST /goals`, `POST /goals/:id/plan`

### 4D: BudgetService (`src/services/budget.service.ts`)
- [ ] `createBudget(userId, data)` → Budget
- [ ] `addExpense(userId, budgetId, data)` → { expense, updatedBudget }
  - Update `budget.remainingAmount`
  - Check threshold: if remaining < 20%, trigger LOW_BUDGET notification
- [ ] `getCurrentBudgets(userId)` → Budget[]
- [ ] Add routes: `POST /budgets`, `POST /expenses`, `GET /budgets/current`

### Definition of Done
✅ All CRUD operations work via API  
✅ Goal plan generates 3x/week activities at default times  
✅ Expense addition updates budget + triggers alert if low

---

## Phase 5: Calendar & Dashboard (Hour 7-9)

### 5A: CalendarService (`src/services/calendar.service.ts`)
- [ ] `generateICS(eventId, eventType)` → iCalendar string
  - Format: `BEGIN:VCALENDAR...BEGIN:VEVENT...END:VEVENT...END:VCALENDAR`
  - Support both bookings and activities
- [ ] Add route: `GET /calendar/event/:id.ics` (returns `.ics` file)

### 5B: Dashboard Endpoint
- [ ] Add `GET /dashboard` to `src/index.ts`:
  ```typescript
  {
    sessions: Session[],
    upcomingBookings: Booking[],
    upcomingActivities: Activity[],
    goals: Goal[],
    budgetSnapshot: {
      budgets: Budget[],
      recentExpenses: Expense[]
    }
  }
  ```
- [ ] Optimize queries (use Prisma `include` to minimize DB calls)

### Definition of Done
✅ `.ics` files download and open in calendar apps  
✅ Dashboard loads all user data in <500ms

---

## Phase 6: Notifications (Hour 9-10)

### Tasks
- [ ] Install: `npm install web-push`
- [ ] Generate VAPID keys: `npx web-push generate-vapid-keys`
- [ ] Create `src/services/notification.service.ts`:
  - `scheduleNotification(userId, type, payload, scheduledFor)`
  - `sendPushNotification(subscription, data)` (using web-push)
  - `checkUpcomingActivities()` (query activities starting in 30 min)
  - `checkLowBudgets()` (query budgets below threshold)
- [ ] Add routes:
  - `POST /push/subscribe` (store user's push subscription)
  - `POST /notify/test` (send test notification)
  - `POST /notify/check` (manual trigger for scheduler)

### Notification Types
- `UPCOMING_ACTIVITY` → "Run starting in 30 minutes"
- `LOW_BUDGET` → "Food budget low: $12 remaining of $60"
- `BOOKING_REMINDER` → "Dinner at The Library tonight at 7pm"

### Definition of Done
✅ User can subscribe to push notifications  
✅ Test notification sends successfully  
✅ Scheduler detects upcoming activities and sends reminders

---

## Phase 7: Testing & Integration (Hour 10+)

### Critical Tests
- [ ] End-to-end flow: "Book dinner tomorrow 7pm for 2" → booking in DB
- [ ] Goal plan: "Run 3x/week" → 3 activities created with recurrence
- [ ] Budget alert: Add expense → remaining < 20% → notification created
- [ ] Calendar export: Download `.ics` → opens in Google/Apple Calendar

### Integration with Person A (Call Experience)
- [ ] Ensure `POST /ai/execute` returns proper response format
- [ ] Session tracking works (`POST /sessions/start`, `/sessions/:id/append`)

### Integration with Person C (Dashboard)
- [ ] `GET /dashboard` returns complete snapshot
- [ ] Real-time updates after actions executed

---

## API Endpoints Checklist

### Auth
- [ ] `POST /auth/login`
- [ ] `POST /auth/demo`

### Dashboard
- [ ] `GET /dashboard`

### Sessions
- [ ] `POST /sessions/start`
- [ ] `POST /sessions/:id/append`
- [ ] `POST /sessions/:id/end`

### AI
- [ ] `POST /ai/execute` ⭐ **CORE ENDPOINT**

### Bookings
- [ ] `POST /bookings`
- [ ] `PATCH /bookings/:id`
- [ ] `GET /bookings/upcoming`

### Activities
- [ ] `POST /activities`
- [ ] `PATCH /activities/:id`
- [ ] `GET /activities/upcoming`

### Goals
- [ ] `POST /goals`
- [ ] `POST /goals/:id/plan`

### Budget
- [ ] `POST /budgets`
- [ ] `POST /expenses`
- [ ] `GET /budgets/current`

### Calendar
- [ ] `GET /calendar/event/:id.ics`

### Notifications
- [ ] `POST /push/subscribe`
- [ ] `POST /notify/test`
- [ ] `POST /notify/check`

---

## Success Criteria

✅ **~90% command routing accuracy**  
✅ **Text commands reliably create bookings/activities/budgets**  
✅ **Dashboard updates instantly after actions**  
✅ **Calendar events downloadable and valid**  
✅ **Notifications fire for upcoming activities and low budgets**  
✅ **Demo completes in 3-5 minutes without errors**

---

## Quick Reference

### OpenAI Function Calling Template
```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [
    { role: "system", content: "Parse booking/activity/budget commands into structured actions." },
    { role: "user", content: userMessage }
  ],
  tools: [{
    type: "function",
    function: {
      name: "execute_actions",
      parameters: {
        type: "object",
        properties: {
          assistant_message: { type: "string" },
          missing_fields: { type: "array", items: { type: "string" } },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["CREATE_BOOKING", "CREATE_ACTIVITY", ...] },
                payload: { type: "object" }
              }
            }
          }
        },
        required: ["assistant_message", "missing_fields", "actions"]
      }
    }
  }],
  tool_choice: { type: "function", function: { name: "execute_actions" } }
});
```

### iCalendar Format Template
```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Moja AI Call Center//EN
BEGIN:VEVENT
UID:${eventId}
DTSTAMP:${now}
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
END:VEVENT
END:VCALENDAR
```

### Goal Plan Heuristic
- **3x/week:** Mon/Wed/Fri at 6:00 PM
- **Daily:** Every day at 6:00 PM
- **2x/week:** Mon/Thu at 6:00 PM
- Generate 4 weeks of occurrences
- Check for conflicts with existing activities (optional optimization)

---

## Notes
- **SQLite = Zero config** (no Supabase needed)
- **Each team member has own dev.db** (no conflicts)
- **Demo from one laptop** (no deployment needed)
- **OpenAI API key required** (set in `.env`)
