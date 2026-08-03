@echo off
setlocal
cd /d "%~dp0"

where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] node.exe was not found. Install Node.js and make sure it is in PATH.
  pause
  exit /b 1
)

if not exist "%~dp0node_modules" (
  echo [ERROR] Dependencies are not installed. Run pnpm install first.
  pause
  exit /b 1
)

echo Checking ports and removing stale template processes ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\prepare-local.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Local ports could not be prepared safely. See the message above.
  pause
  exit /b 1
)

echo Starting API on http://127.0.0.1:3001 ...
start "Template API - keep this window open" /min cmd.exe /k "cd /d "%~dp0apps\api" && node.exe node_modules\@nestjs\cli\bin\nest.js start --watch"

echo Starting Admin on http://127.0.0.1:3000 ...
start "Template Admin - keep this window open" /min cmd.exe /k "cd /d "%~dp0apps\admin" && node.exe node_modules\vite\bin\vite.js --host 127.0.0.1 --port 3000"

set "WAIT_WEB="
node.exe -e "const c=require('./project.config.json');process.exit(c.modules.userWeb&&c.modules.customerAuthentication?0:1)"
if errorlevel 1 (
  echo User Web is disabled by project.config.json.
  set "WAIT_WEB=-SkipWeb"
) else (
  echo Starting Web on http://127.0.0.1:3002 ...
  start "Template Web - keep this window open" /min cmd.exe /k "cd /d "%~dp0apps\web" && node.exe node_modules\nuxt\bin\nuxt.mjs dev --host 127.0.0.1 --port 3002"
)

echo Waiting for services ...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\wait-for-local.ps1" %WAIT_WEB%
if errorlevel 1 (
  echo.
  echo One or more services did not start. Check the two service windows for errors.
  pause
  exit /b 1
)

echo Services are ready. Opening Admin ...
start "" "http://127.0.0.1:3000"
exit /b 0
