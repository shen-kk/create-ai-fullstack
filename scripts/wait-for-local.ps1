$ErrorActionPreference = 'SilentlyContinue'
$deadline = (Get-Date).AddSeconds(45)
$adminReady = $false
$apiReady = $false

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

  if ($adminReady -and $apiReady) {
    Write-Host '[OK] Admin and API are ready.' -ForegroundColor Green
    exit 0
  }

  Start-Sleep -Seconds 1
}

Write-Host "[ERROR] Startup timed out. Admin=$adminReady API=$apiReady" -ForegroundColor Red
exit 1
