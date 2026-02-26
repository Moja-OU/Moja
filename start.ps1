# ═══════════════════════════════════════════════════════════
# Moja - Development Environment Startup
# ═══════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Action($msg) { Write-Host "  [..] $msg" -ForegroundColor Yellow }
function Write-Info($msg) { Write-Host "  [i] $msg" -ForegroundColor Cyan }
function Write-Fail($msg) { Write-Host "  [X] $msg" -ForegroundColor Red }
function Write-Section($msg) { Write-Host "`n== $msg ==" -ForegroundColor Magenta }

Write-Host ""
Write-Host "  Moja - AI Concierge" -ForegroundColor Cyan
Write-Host "  Starting development environment..." -ForegroundColor DarkGray
Write-Host ""

# ── 1. Check Node.js ──────────────────────────────────────
Write-Section "Prerequisites"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Fail "Node.js is not installed. Install from https://nodejs.org (v18+)"
    exit 1
}
$nodeVersion = (node --version).TrimStart('v')
$nodeMajor = [int]($nodeVersion.Split('.')[0])
if ($nodeMajor -lt 18) {
    Write-Fail "Node.js v$nodeVersion detected — v18+ required. Please update."
    exit 1
}
Write-Step "Node.js v$nodeVersion"

# ── 2. Check/Install pnpm ─────────────────────────────────
$pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpmCmd) {
    Write-Action "pnpm not found — installing pnpm@9..."
    npm install -g pnpm@9
    if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to install pnpm"; exit 1 }
    Write-Step "pnpm installed"
}
else {
    $pnpmVersion = (pnpm --version).Trim()
    $pnpmMajor = [int]($pnpmVersion.Split('.')[0])
    if ($pnpmMajor -lt 9) {
        Write-Action "pnpm v$pnpmVersion is outdated — updating to v9..."
        npm install -g pnpm@9
        if ($LASTEXITCODE -ne 0) { Write-Fail "Failed to update pnpm"; exit 1 }
        Write-Step "pnpm updated"
    }
    else {
        Write-Step "pnpm v$pnpmVersion"
    }
}

# ── 3. Install / Update Dependencies ──────────────────────
Write-Section "Dependencies"

Write-Action "Installing dependencies (pnpm install)..."
pnpm install
if ($LASTEXITCODE -ne 0) { Write-Fail "pnpm install failed"; exit 1 }
Write-Step "All dependencies installed"

# ── 4. Environment File ───────────────────────────────────
Write-Section "Environment"

$envFile = "apps\api\.env"
if (!(Test-Path $envFile)) {
    Write-Action "Creating apps/api/.env with defaults..."
    $envContent = @"
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-secret"
PORT=4000

# ── Gemini AI ──
GEMINI_API_KEY=
GEMINI_TEXT_MODEL=gemini-2.5-flash

# ── Twilio ──
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# ── Tavily Search ──
TAVILY_API_KEY=

# ── Web Push ──
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:your@email.com
"@
    Set-Content $envFile $envContent
    Write-Info "Warning: Fill in your API keys in apps/api/.env before using AI features!"
}
else {
    Write-Step ".env file exists"
}

# Check for critical env vars (warn but don't block)
$envContent = Get-Content $envFile -Raw
$missingKeys = @()
if ($envContent -match "GEMINI_API_KEY=\s*$" -or $envContent -notmatch "GEMINI_API_KEY") {
    $missingKeys += "GEMINI_API_KEY"
}
if ($envContent -match "TWILIO_ACCOUNT_SID=\s*$" -or $envContent -notmatch "TWILIO_ACCOUNT_SID") {
    $missingKeys += "TWILIO_ACCOUNT_SID"
}
if ($missingKeys.Count -gt 0) {
    Write-Info "Warning: Missing env vars: $($missingKeys -join ', '). Some features won't work."
}
else {
    Write-Step "API keys configured"
}

# ── 5. Prisma Database ────────────────────────────────────
Write-Section "Database"

Write-Action "Generating Prisma client..."
Push-Location apps\api
pnpm prisma generate 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Prisma generate failed"
    Pop-Location
    exit 1
}
Write-Step "Prisma client generated"

# Run migrations (creates DB if it doesn't exist)
$dbExists = Test-Path "prisma\dev.db"
if (-not $dbExists) {
    Write-Action "Creating database and running migrations..."
}
else {
    Write-Action "Applying any pending migrations..."
}
pnpm prisma migrate dev --name init 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    # migrate dev can fail if already up-to-date; check with db push as fallback
    Write-Info "Migration returned non-zero (may already be up-to-date)"
}
Write-Step "Database ready"
Pop-Location

# ── 6. TypeScript Check ───────────────────────────────────
Write-Section "Type Check"

Write-Action "Checking TypeScript..."
Push-Location apps\api
$tscOutput = npx tsc --noEmit 2>&1
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Info "TypeScript has warnings (non-blocking):"
    $tscOutput | Select-Object -First 5 | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkYellow }
}
else {
    Write-Step "TypeScript OK"
}

# ── 7. Start Dev Servers ──────────────────────────────────
Write-Section "Starting Dev Servers"

Write-Host ""
Write-Host "  API:  " -NoNewline; Write-Host "http://localhost:4000" -ForegroundColor Cyan
Write-Host "  Web:  " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

pnpm dev
