# Moja - Start Development Environment

Write-Host "Starting Moja..." -ForegroundColor Green

# Check if pnpm is installed
if (!(Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm@9
}

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
pnpm install

# Create .env if it doesn't exist
if (!(Test-Path "apps\api\.env")) {
    Write-Host "Creating apps/api/.env..." -ForegroundColor Cyan
    Set-Content "apps\api\.env" "DATABASE_URL=`"file:./dev.db`"`nJWT_SECRET=`"dev-secret`"`nPORT=4000"
}

# Prisma setup
Write-Host "Setting up database..." -ForegroundColor Yellow
Set-Location apps\api
pnpm prisma generate
pnpm prisma migrate dev --name init
Set-Location ..\..

# Start dev servers
Write-Host ""
Write-Host "  API: http://localhost:4000" -ForegroundColor Cyan
Write-Host "  Web: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
pnpm dev
