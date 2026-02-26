# Moja

AI Call Center Concierge — Hacklahoma 2026

## Description
Billions of people worldwide, especially in rural communities, don't have access to Siri, Alexa, or smart assistants. They don't have the latest iPhone or reliable internet. But almost everyone has a phone number.

Moja (meaning "the first one" in Swahili) is an AI personal assistant you access by making a simple phone call. No app download. No smartphone required. No internet needed. You call in, verify with a PIN, and just talk about booking appointments, setting budgets, tracking goals, and planning your week.

Every conversation is automatically transcribed from speech to text, so nothing is ever lost. Your full history of requests, bookings, and plans is stored and synced to a web dashboard whenever you have connectivity.

We're actively building multilingual support so that people who are illiterate or from indigenous regions can interact with AI entirely through voice in their own language. No reading or typing required.

Our vision is for Moja to be completely free, a public utility hotline, like dialing 911. Because access to AI shouldn't depend on how much money you have or what phone you can afford.

One phone call replaces the assistant that Big Tech gatekeeps behind expensive hardware.

> "Imagine if anyone on Earth could pick up any phone, dial a number, and have a personal AI assistant in their language, for free. That's Moja."

## Structure

```
apps/
  web/       -> Next.js frontend (localhost:3000)
  api/       -> Express + Prisma API (localhost:4000)
    scripts/ -> Dev helper scripts (create-user, test-sms, etc.)
packages/
  types/     -> Shared TypeScript types
  ui/        -> Shared React components
  utils/     -> Shared utility functions
```

## Tech Stack

### Frontend
- **Next.js** (React) — Web dashboard
- **Tailwind CSS + shadcn/ui** — Modern UI components
- **TypeScript** — Type-safe across the entire codebase

### Backend
- **Express.js** (Node.js) — REST API
- **Prisma ORM + SQLite** — Database layer (easily swappable to PostgreSQL)
- **JWT** — Token-based authentication for web; PIN-based auth for voice

### AI / Intelligence
- **Google Gemini 2.5** — Natural language understanding, action orchestration, and realtime voice
- **Gemini Live API (WebSocket)** — Low-latency, bidirectional voice streaming with interruption support
- **Tavily Search API** — Real-time web search (weather, restaurants, business hours, etc.)
- **Tool Calling (Function Calling)** — Structured actions (CREATE_BOOKING, SET_BUDGET, etc.)

### Voice / Telephony
- **Twilio Voice API + Media Streams** — Incoming calls & bidirectional audio streaming
- **WebSocket bridge** — Routes Twilio audio stream ↔ Gemini Live API in real time
- **ngrok** — Tunnel local server to public URL for Twilio webhooks

### Infrastructure
- **Turborepo + pnpm** — Monorepo managing frontend, backend, and shared packages
- **bcrypt** — Secure password hashing

## Getting Started

**Prerequisites:** Node.js ≥18, pnpm ≥9

```bash
# Option A: one command
.\start.ps1

# Option B: manual
pnpm install
cd apps/api && npx prisma generate && npx prisma migrate dev --name init && cd ../..
pnpm dev
```

- **Web:** http://localhost:3000
- **API:** http://localhost:4000

## Environment Variables

Create `apps/api/.env`:

```env
# Database
DATABASE_URL="file:./dev.db"

# Auth
JWT_SECRET="your-jwt-secret"

# Google Gemini (https://aistudio.google.com/)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_TEXT_MODEL="gemini-2.5-flash"
GEMINI_MODEL="gemini-2.5-flash-native-audio-latest"

# Twilio (https://console.twilio.com/)
TWILIO_ACCOUNT_SID="your-account-sid"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_PHONE_NUMBER="+1xxxxxxxxxx"
TWILIO_WEBHOOK_URL="https://your-ngrok-url.ngrok-free.dev"

# Tavily Search (https://tavily.com/)
TAVILY_API_KEY="your-tavily-key"

# Server
PORT=4000
```

## Voice Setup (for local dev)

1. Run `npx ngrok http 4000` to get a public URL
2. Set `TWILIO_WEBHOOK_URL` in `.env` to the ngrok URL
3. In the [Twilio console](https://console.twilio.com), set your phone number's webhook to `https://your-ngrok-url/voice/incoming`
4. Call your Twilio number — Moja will answer!

## SMS Setup (for local dev)

1. In the [Twilio console](https://console.twilio.com), set your phone number's SMS webhook to `https://your-ngrok-url/sms/incoming`
2. Text your Twilio number — authenticate with your PIN, then chat!
3. To test locally without Twilio credits:
   ```bash
   cd apps/api && node scripts/test-sms.js --from "+1YOURNUMBER"
   ```

## Dev Scripts

Helper scripts live in `apps/api/scripts/`:

| Script | Purpose |
|--------|----------|
| `create-user.js` | Create/reset a test user |
| `set-pin.js` | Set a user's voice PIN |
| `test-sms.js` | Interactive SMS simulator (no Twilio needed) |
| `check-user.js` | Inspect a user record |
| `check-data.js` | View user's sessions, bookings, activities |
| `check-sms.js` | View recent SMS session transcripts |

Run from `apps/api/`: `node scripts/<script-name>.js`

---

## 🏗️ How We Built This

Moja was built in 24 hours at **Hacklahoma 2026** by a small team of 3 driven by one big idea: *what if AI wasn't just for people who could afford a smartphone?*

We started with a clear stack decision — a **Turborepo monorepo** to keep the frontend, backend, and shared packages in sync. The API is built on **Express.js + Prisma**, with **Next.js** powering the web dashboard.

For voice, we initially integrated **Twilio Voice API** for call handling and whisper transcription. As we iterated, we migrated to **Twilio Media Streams** + **Google Gemini 2.5 Live API** over WebSockets — enabling truly real-time, bidirectional voice conversation with sub-second latency and natural interruption handling.

The AI layer uses **Gemini's function calling** to route user intent into structured actions: booking appointments, setting budgets, searching the web via **Tavily**, and managing personal goals — all through natural speech.

---

## 🧗 Challenges

- **Real-time audio bridging** — Getting Twilio's Mu-law 8kHz audio to cleanly transcode and stream into Gemini's PCM 24kHz format in real time required building custom audio conversion utilities from scratch.
- **Strategic API pivot under time pressure** — Mid-hackathon, we made the call to migrate from Azure OpenAI to Google Gemini to compete for the **Best Use of Gemini** prize. This meant a full rewrite of the voice service in a few hours — a calculated risk that pushed us technically and paid off in learning.
- **Latency tuning** — Achieving a natural conversation feel over a phone call (without awkward silence) involved careful WebSocket event sequencing and audio chunk pipelining.
- **Session management** — Preserving conversation context across call reconnects and syncing voice sessions to the web dashboard required thoughtful database schema design.
- **Auth over voice** — Implementing PIN-based identity verification purely through phone DTMF or speech (with no app or web UI) was a novel UX challenge.

---

## ✅ What We Achieved

- ✅ Working AI phone assistant — call a real number, talk naturally, get real answers
- ✅ Real-time voice streaming with **Gemini 2.5 Live API** (WebSocket bidirectional audio)
- ✅ AI-powered actions: bookings, budgets, goals, and web search — all via voice
- ✅ Full web dashboard synced to call history and user data
- ✅ Secure PIN-based authentication — no app required
- ✅ Clean monorepo architecture ready to scale

---

## 🚀 Future Improvements

- 🌍 **Multilingual support** — Detect and respond in the caller's native language using Gemini's multilingual capabilities (Spanish, French, Swahili, Hindi, and more)
- 📱 **Free SMS follow-ups** — Send a text summary of every call (bookings confirmed, goals set, search results) so users have a record even without internet
- 📞 **Free outbound calls** — Proactively call users for appointment reminders, budget alerts, and goal check-ins
- 🧠 **Long-term memory** — Persist user preferences, recurring tasks, and life context across all sessions
- 🔒 **Voice biometric auth** — Replace PIN with voice fingerprint recognition for seamless, secure identity
- 🌐 **Offline-first sync** — Queue actions taken offline and sync when connectivity is restored
- 🏥 **Domain-specific modes** — Healthcare, financial advising, legal aid — specialized Moja "agents" for high-impact verticals
- 📊 **Usage analytics dashboard** — Help NGOs and governments understand community needs through anonymized usage patterns
