# Moja

AI Call Center Concierge — Hacklahoma 2026

## Description
Billions of people worldwide, especially in rural communities, don't have access to Siri, Alexa, or smart assistants. They don't have the latest iPhone or reliable internet. But almost everyone has a phone number.

Moja (meaning "the first one" in Swahili) is an AI personal assistant you access by making a simple phone call. No app download. No smartphone required. No internet needed. You call in, verify with a PIN, and just talk about booking appointments, setting budgets, tracking goals, and planning your week.

Every conversation is automatically transcribed from speech to text, so nothing is ever lost. Your full history of requests, bookings, and plans is stored and synced to a web dashboard whenever you have connectivity.

We're actively building multilingual support so that people who are illiterate or from indigenous regions can interact with AI entirely through voice in their own language. No reading or typing required.

Our vision is for Moja to be completely free, a public utility hotline, like dialing 911. Because access to AI shouldn't depend on how much money you have or what phone you can afford.

One phone call replaces the assistant that Big Tech gatekeeps behind expensive hardware.

"Imagine if anyone on Earth could pick up any phone, dial a number, and have a personal AI assistant in their language, for free. That's Moja."

## Structure

```
apps/
  web/     → Next.js frontend (localhost:3000)
  api/     → Express + Prisma API (localhost:4000)
packages/
  types/   → Shared TypeScript types
  ui/      → Shared React components
  utils/   → Shared utility functions
```

## Tech Stack

### Frontend
- **Next.js 16** (React) — Web dashboard
- **Tailwind CSS + shadcn/ui** — Modern UI components
- **TypeScript** — Type-safe across the entire codebase

### Backend
- **Express.js** (Node.js) — REST API
- **Prisma ORM + SQLite** — Database layer (easily swappable to PostgreSQL)
- **JWT** — Token-based authentication for web; PIN-based auth for voice

### AI / Intelligence
- **Azure OpenAI (GPT-4.1)** — Natural language interpretation and action orchestration
- **Tavily Search API** — Real-time web search (weather, restaurants, business hours, etc.)
- **Tool Calling (Function Calling)** — Structured actions (CREATE_BOOKING, SET_BUDGET, etc.)

### Voice / Telephony
- **Twilio Voice API** — Incoming calls, speech-to-text transcription, text-to-speech
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

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret"
PORT=4000
```
