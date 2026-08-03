param([switch]$SkipWeb)

$ErrorActionPreference = 'SilentlyContinue'
$deadline = (Get-Date).AddSeconds(45)
$adminReady = $false
$apiReady = $false
$webReady = $false

while ((Get-Date) -lt $deadline) {
  try {
    $adminResponse = Invoke-WebRequest 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2
    $adminReady = $adminResponse.StatusCode -eq 200
  } catch {
    $adminReady = $false
  }

  try {
    $apiResponse = Invoke-RestMethod 'http://127.0.0.1:3001/api/health' -TimeoutSec 2
    $apiReady = $apiResponse.status -eq 'ok'
  } catch {
    $apiReady = $false
  }

  try {
    $webResponse = Invoke-WebRequest 'http://127.0.0.1:3002' -UseBasicParsing -TimeoutSec 2
    $webReady = $webResponse.StatusCode -eq 200
  } catch {
    $webReady = $false
  }

  if ($adminReady -and $apiReady -and ($SkipWeb -or $webReady)) {
    Write-Host '[OK] Admin, API and Web are ready.' -ForegroundColor Green
    exit 0
  }

  Start-Sleep -Seconds 1
}

Write-Host "[ERROR] Startup timed out. Admin=$adminReady API=$apiReady Web=$webReady SkipWeb=$SkipWeb" -ForegroundColor Red
exit 1
