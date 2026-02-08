# Moja

AI Call Center Concierge — Hacklahoma 2026

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
