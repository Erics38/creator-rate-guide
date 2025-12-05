# Integration Test Script for Phase 3A
# Tests the full stack: Frontend → API Gateway → Lambda → DynamoDB

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 3A Integration Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$API_URL = "https://k0oldo3mk1.execute-api.us-east-1.amazonaws.com/prod"

# Test 1: API Health Check (GET /collaborations)
Write-Host "Test 1: Testing GET /collaborations..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_URL/collaborations" -Method GET
    Write-Host "✓ GET request successful" -ForegroundColor Green
    Write-Host "  Found $($response.count) collaborations" -ForegroundColor Gray
} catch {
    Write-Host "✗ GET request failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Save New Collaboration (POST /collaborations)
Write-Host "Test 2: Testing POST /collaborations..." -ForegroundColor Yellow

$testData = @{
    creatorName = "integration_test_creator"
    averageViews = 30000
    lowestViews = 20000
    targetCPM = 18
    projectedViews = 23000
    recommendedPrice = 414
    confidence = 75
    reasoning = "Integration test from PowerShell script"
    priceRange = @{
        min = 331
        max = 497
    }
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$API_URL/collaborations" -Method POST -Body $testData -ContentType "application/json"
    Write-Host "✓ POST request successful" -ForegroundColor Green
    Write-Host "  Saved collaboration ID: $($response.data.id)" -ForegroundColor Gray
    $savedId = $response.data.id
} catch {
    Write-Host "✗ POST request failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Verify Data in DynamoDB
Write-Host "Test 3: Verifying data in DynamoDB..." -ForegroundColor Yellow
try {
    $dbItems = aws dynamodb scan --table-name InfluencerCollaborations | ConvertFrom-Json
    $testItem = $dbItems.Items | Where-Object { $_.creatorName.S -eq "integration_test_creator" }

    if ($testItem) {
        Write-Host "✓ Data verified in DynamoDB" -ForegroundColor Green
        Write-Host "  Creator: $($testItem.creatorName.S)" -ForegroundColor Gray
        Write-Host "  Avg Views: $($testItem.averageViews.N)" -ForegroundColor Gray
        Write-Host "  Recommended Price: $($testItem.recommendedPrice.N)" -ForegroundColor Gray
    } else {
        Write-Host "✗ Test data not found in DynamoDB" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ DynamoDB verification failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All Integration Tests Passed! ✓" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Open browser: http://localhost:8081" -ForegroundColor Gray
Write-Host "2. Test calculator and save functionality" -ForegroundColor Gray
Write-Host "3. Check 'Collaboration History' tab" -ForegroundColor Gray
Write-Host "4. Verify you see 'integration_test_creator' in the list" -ForegroundColor Gray
Write-Host ""
