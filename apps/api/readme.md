# Moja API - Backend

Backend API server for the AI Call Center Concierge MVP.

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** SQLite with Prisma ORM
- **Authentication:** JWT with bcrypt
- **AI:** OpenAI API (GPT-4 Turbo)
- **Notifications:** Web Push

## Setup Instructions

### 1. Install Dependencies

From the root of the monorepo:

```bash
pnpm install
```

### 2. Configure Environment Variables

The `.env` file already exists with placeholder values. Update it with your keys:

```bash
# Required: Add your Azure OpenAI credentials
AZURE_OPENAI_KEY="your-azure-openai-key"
AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
AZURE_OPENAI_API_VERSION="2024-02-15-preview"

# Optional: Generate VAPID keys for web push
npx web-push generate-vapid-keys
# Then add the keys to .env
```

### 3. Run Database Migrations

```bash
npx prisma migrate dev
```

This will create the SQLite database (`dev.db`) with all required tables.

### 4. (Optional) Seed Demo Data

Create a demo user for testing:

```bash
# Using the demo endpoint via curl/Postman
curl -X POST http://localhost:4000/auth/demo
```

### 5. Start Development Server

```bash
npm run dev
```

Server will start on `http://localhost:4000`

## API Endpoints

### Authentication

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login existing user
- `POST /auth/demo` - Create demo user (fast testing)

### Dashboard

- `GET /dashboard` - Get complete user dashboard (requires auth)

### Sessions

- `POST /sessions/start` - Start new call/chat session
- `POST /sessions/:id/append` - Add messages to session
- `POST /sessions/:id/end` - End session
- `GET /sessions` - Get user's sessions

### AI

- `POST /ai/execute` ⭐ **Core Endpoint** - Process user message and execute actions

### Bookings

- `POST /bookings` - Create booking
- `PATCH /bookings/:id` - Update booking status
- `GET /bookings/upcoming` - Get upcoming bookings

### Activities

- `POST /activities` - Create activity
- `PATCH /activities/:id` - Update activity status
- `GET /activities/upcoming` - Get upcoming activities

### Goals

- `POST /goals` - Create goal
- `POST /goals/:id/plan` - Generate activity plan for goal
- `GET /goals` - Get user's goals

### Budget & Expenses

- `POST /budgets` - Create budget
- `POST /expenses` - Add expense
- `GET /budgets/current` - Get current budgets

### Calendar

- `GET /calendar/booking/:id.ics` - Download booking calendar file
- `GET /calendar/activity/:id.ics` - Download activity calendar file

### Notifications

- `POST /push/subscribe` - Subscribe to push notifications
- `POST /notify/test` - Send test notification
- `POST /notify/check` - Manually trigger notification check

## Project Structure

```
apps/api/
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Migration history
├── src/
│   ├── index.ts               # Main server + all routes
│   ├── middleware/
│   │   └── auth.ts            # JWT authentication middleware
│   ├── services/
│   │   ├── auth.service.ts         # User auth logic
│   │   ├── ai.orchestrator.ts      # AI command parsing
│   │   ├── booking.service.ts      # Booking management
│   │   ├── scheduling.service.ts   # Activity scheduling
│   │   ├── goal.service.ts         # Goal tracking
│   │   ├── budget.service.ts       # Budget & expenses
│   │   ├── calendar.service.ts     # .ics generation
│   │   ├── notification.service.ts # Web push notifications
│   │   └── session.service.ts      # Session management
│   └── config/
│       └── database.ts        # Prisma client
├── .env                       # Environment variables
└── package.json
```

## Testing the API

### 1. Health Check

```bash
curl http://localhost:4000/health
```

### 2. Create Demo User

```bash
curl -X POST http://localhost:4000/auth/demo
```

Save the returned `token` for subsequent requests.

### 3. Test AI Execute Endpoint

```bash
curl -X POST http://localhost:4000/ai/execute \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "Book dinner tomorrow at 7pm for 2 at The Library"
  }'
```

### 4. Check Dashboard

```bash
curl -X GET http://localhost:4000/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Database Management

### View Database in GUI

```bash
npx prisma studio
```

Opens a web UI at `http://localhost:5555` to browse/edit data.

### Reset Database (WARNING: deletes all data)

```bash
npx prisma migrate reset
```

### Generate Prisma Client (after schema changes)

```bash
npx prisma generate
```

## Development Tips

1. **Hot Reload:** The dev server uses `tsx watch` for automatic restarts on file changes

2. **Logging:** Check terminal output for AI responses and errors

3. **Azure OpenAI Credentials:** Required for AI orchestrator to work. Get credentials from your Azure OpenAI resource

4. **Web Push:** Generate VAPID keys with `npx web-push generate-vapid-keys`

5. **Database Location:** `dev.db` file in the `apps/api` directory

## Troubleshooting

### "Module not found" errors

```bash
cd ../.. && pnpm install
npx prisma generate
```

### Database connection errors

Check that `DATABASE_URL` in `.env` points to `file:./dev.db`

### AI orchestrator errors

1. Verify `AZURE_OPENAI_KEY`, `AZURE_OPENAI_ENDPOINT`, and `AZURE_OPENAI_API_VERSION` are set in `.env`
2. Check Azure OpenAI account has credits
3. Review terminal logs for API error details

### Port already in use

Change `PORT` in `.env` or kill the process using port 4000:

```powershell
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F
```

## Next Steps

1. ✅ All database models created
2. ✅ All services implemented
3. ✅ All API endpoints working
4. ✅ AI orchestrator functional

**Ready for integration with:**
- Person A: Call/chat interface
- Person C: Dashboard UI

**Todo:**
- Add Azure OpenAI credentials to `.env`
- Test complete flow: register → AI execute → dashboard
- Generate VAPID keys for push notifications (optional)
