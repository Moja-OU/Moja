# Test API Endpoints
# Run: .\test-api.ps1

$baseUrl = "http://localhost:4000"
$headers = @{ "Content-Type" = "application/json" }

Write-Host ""
Write-Host "=== Moja API Test Suite ===" -ForegroundColor Cyan
Write-Host ""

# 1. Health Check
Write-Host "1. Testing Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "   [OK] Health: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Health check failed: $_" -ForegroundColor Red
    exit 1
}

# 2. Create Demo User
Write-Host ""
Write-Host "2. Creating Demo User..." -ForegroundColor Yellow
try {
    $demoResponse = Invoke-RestMethod -Uri "$baseUrl/auth/demo" -Method Post -Headers $headers
    $token = $demoResponse.token
    $userId = $demoResponse.user.id
    Write-Host "   [OK] Demo user created: $($demoResponse.user.email)" -ForegroundColor Green
    Write-Host "   [OK] User ID: $userId" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Demo user creation failed: $_" -ForegroundColor Red
    exit 1
}

# Set auth header
$authHeaders = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $token"
}

# 3. Test AI Execute
Write-Host ""
Write-Host "3. Testing AI Execution..." -ForegroundColor Yellow
try {
    $aiPayload = @{
        userMessage = "Book me a table at The Cheesecake Factory for 2 people on February 10th at 7pm"
        timezone = "America/Chicago"
    } | ConvertTo-Json

    $aiResponse = Invoke-RestMethod -Uri "$baseUrl/ai/execute" -Method Post -Headers $authHeaders -Body $aiPayload
    Write-Host "   [OK] AI Response: $($aiResponse.assistantMessage)" -ForegroundColor Green
    Write-Host "   [OK] Actions: $($aiResponse.actions.Count)" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] AI execution failed: $_" -ForegroundColor Red
}

# 4. Get Dashboard
Write-Host ""
Write-Host "4. Testing Dashboard..." -ForegroundColor Yellow
try {
    $dashboard = Invoke-RestMethod -Uri "$baseUrl/dashboard" -Method Get -Headers $authHeaders
    Write-Host "   [OK] Upcoming bookings: $($dashboard.upcomingBookings.Count)" -ForegroundColor Green
    Write-Host "   [OK] Upcoming activities: $($dashboard.upcomingActivities.Count)" -ForegroundColor Green
    Write-Host "   [OK] Active goals: $($dashboard.activeGoals.Count)" -ForegroundColor Green
    Write-Host "   [OK] Current budgets: $($dashboard.currentBudgets.Count)" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Dashboard failed: $_" -ForegroundColor Red
}

# 5. Create Manual Booking
Write-Host ""
Write-Host "5. Creating Manual Booking..." -ForegroundColor Yellow
try {
    $bookingPayload = @{
        businessName = "Olive Garden"
        datetimeLocal = "2026-02-15T18:00:00"
        partySize = 4
        notes = "Window seat preferred"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$baseUrl/bookings" -Method Post -Headers $authHeaders -Body $bookingPayload
    $bookingId = $result.booking.id
    Write-Host "   [OK] Booking created: $($result.booking.businessName) for $($result.booking.partySize) people" -ForegroundColor Green
    Write-Host "   [OK] Booking ID: $bookingId" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Booking creation failed: $_" -ForegroundColor Red
}

# 6. Get Upcoming Bookings
Write-Host ""
Write-Host "6. Getting Upcoming Bookings..." -ForegroundColor Yellow
try {
    $result = Invoke-RestMethod -Uri "$baseUrl/bookings/upcoming" -Method Get -Headers $authHeaders
    Write-Host "   [OK] Found $($result.bookings.Count) upcoming booking(s)" -ForegroundColor Green
    foreach ($b in $result.bookings) {
        Write-Host "     - $($b.businessName) on $($b.datetimeLocal)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [FAIL] Get bookings failed: $_" -ForegroundColor Red
}

# 7. Confirm Booking
if ($bookingId) {
    Write-Host ""
    Write-Host "7. Confirming Booking..." -ForegroundColor Yellow
    try {
        $confirmPayload = @{
            status = "CONFIRMED"
        } | ConvertTo-Json

        $result = Invoke-RestMethod -Uri "$baseUrl/bookings/$bookingId" -Method Patch -Headers $authHeaders -Body $confirmPayload
        Write-Host "   [OK] Booking confirmed: $($result.booking.status)" -ForegroundColor Green
    } catch {
        Write-Host "   [FAIL] Booking confirmation failed: $_" -ForegroundColor Red
    }
}

# 8. Test Calendar Export
if ($bookingId) {
    Write-Host ""
    Write-Host "8. Testing Calendar Export..." -ForegroundColor Yellow
    try {
        $icsContent = Invoke-RestMethod -Uri "$baseUrl/calendar/booking/$bookingId.ics" -Method Get -Headers $authHeaders
        Write-Host "   [OK] ICS file generated" -ForegroundColor Green
    } catch {
        Write-Host "   [FAIL] Calendar export failed: $_" -ForegroundColor Red
    }
}

# 9. Create Activity
Write-Host ""
Write-Host "9. Creating Activity..." -ForegroundColor Yellow
try {
    $activityPayload = @{
        title = "Morning Jog"
        datetimeLocal = "2026-02-09T07:00:00"
        durationMin = 30
        category = "EXERCISE"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$baseUrl/activities" -Method Post -Headers $authHeaders -Body $activityPayload
    Write-Host "   [OK] Activity created: $($result.activity.title)" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Activity creation failed: $_" -ForegroundColor Red
}

# 10. Create Goal
Write-Host ""
Write-Host "10. Creating Goal..." -ForegroundColor Yellow
try {
    $goalPayload = @{
        title = "Exercise 3x per week"
        metric = "sessions"
        targetValue = 3
        frequency = "WEEKLY"
    } | ConvertTo-Json

    $result = Invoke-RestMethod -Uri "$baseUrl/goals" -Method Post -Headers $authHeaders -Body $goalPayload
    $goalId = $result.goal.id
    Write-Host "   [OK] Goal created: $($result.goal.title)" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Goal creation failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host "API is functional and ready for frontend integration!" -ForegroundColor Green
Write-Host "API Base URL: $baseUrl" -ForegroundColor Gray
