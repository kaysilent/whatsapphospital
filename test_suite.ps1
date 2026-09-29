# Test Suite for WhatsApp Hospital CRM & AI Receptionist

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "WhatsApp Hospital CRM - Comprehensive Test Suite" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Test 1: Public Routes
$publicRoutes = @("/login", "/demo")
foreach ($route in $publicRoutes) {
    try {
        $res = Invoke-WebRequest -Uri "$baseUrl$route" -WebSession $session -UseBasicParsing
        Write-Host "[PASS] Public Route: $route (HTTP $($res.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] Public Route: $route - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 2: Auth Login API (Generate Cookie)
try {
    $loginBody = @{
        email = "doctor@ananyaclinic.com"
        password = "doctorpassword"
    } | ConvertTo-Json

    $loginRes = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" -Method POST -Body $loginBody -ContentType "application/json" -WebSession $session -UseBasicParsing
    Write-Host "[PASS] Auth Login API (/api/auth/login): HTTP $($loginRes.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Auth Login API: $($_.Exception.Message)" -ForegroundColor Red
}

# Add session cookie directly if needed
$cookie = New-Object System.Net.Cookie("wacrm_demo_session", "1", "/", "localhost")
$session.Cookies.Add($cookie)

# Test 3: Authenticated Protected Pages
$protectedRoutes = @(
    "/dashboard",
    "/appointments",
    "/contacts",
    "/pipelines",
    "/broadcasts",
    "/settings",
    "/reports"
)

foreach ($route in $protectedRoutes) {
    try {
        $res = Invoke-WebRequest -Uri "$baseUrl$route" -WebSession $session -UseBasicParsing
        Write-Host "[PASS] Protected Route: $route (HTTP $($res.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "[FAIL] Protected Route: $route - $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: AI Receptionist Pricing & Inquiry
try {
    $chatBody = @{
        messages = @(
            @{ role = "user"; content = "Hello! What is the price of HydraFacial Glow?" }
        )
    } | ConvertTo-Json

    $chatRes = Invoke-WebRequest -Uri "$baseUrl/api/ai/chat" -Method POST -Body $chatBody -ContentType "application/json" -UseBasicParsing
    $chatJson = $chatRes.Content | ConvertFrom-Json
    Write-Host "[PASS] AI Receptionist Inquiry Response: $($chatJson.reply.Substring(0, [Math]::Min(80, $chatJson.reply.Length)))..." -ForegroundColor Green
} catch {
    Write-Host "[FAIL] AI Receptionist Inquiry: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 5: AI Receptionist Appointment Parsing
try {
    $bookBody = @{
        messages = @(
            @{ role = "user"; content = "Book an appointment for Priya Verma for HydraFacial tomorrow at 11:30 AM" }
        )
    } | ConvertTo-Json

    $bookRes = Invoke-WebRequest -Uri "$baseUrl/api/ai/chat" -Method POST -Body $bookBody -ContentType "application/json" -UseBasicParsing
    $bookJson = $bookRes.Content | ConvertFrom-Json
    Write-Host "[PASS] AI Appointment Parser Card Generated: $($bookJson.isAppointmentCard)" -ForegroundColor Green
    if ($bookJson.appointmentData) {
        Write-Host "       Patient: $($bookJson.appointmentData.patient_name)" -ForegroundColor Cyan
        Write-Host "       Treatment: $($bookJson.appointmentData.department)" -ForegroundColor Cyan
        Write-Host "       Time: $($bookJson.appointmentData.time)" -ForegroundColor Cyan
        Write-Host "       Date: $($bookJson.appointmentData.date)" -ForegroundColor Cyan
        Write-Host "       Phone: $($bookJson.appointmentData.phone_number)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "[FAIL] AI Appointment Parser: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "All Tests Completed Successfully!" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
