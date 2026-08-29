$ErrorActionPreference = 'Stop'
$script = Get-Content (Join-Path $PSScriptRoot 'prepare-local.ps1') -Raw -Encoding utf8
if ($script -notmatch 'Port \$port is used by another program') { throw 'Foreign-process protection is missing' }
if ($script -notmatch '\$process\.CommandLine -notmatch \$workspacePattern') { throw 'Workspace ownership check is missing' }
if ($script -notmatch 'Stop-Process -Id') { throw 'Stale project process cleanup is missing' }
if ($script -notmatch 'projectConfig\.runtime\.adminPort') { throw 'Configured Admin port is not loaded' }
if ($script -notmatch 'projectConfig\.runtime\.apiPort') { throw 'Configured API port is not loaded' }
Write-Host '[OK] prepare-local.ps1 safety guards are present'
