param(
  [int[]]$Ports = @(3000, 3001, 3002)
)

$ErrorActionPreference = 'Stop'
$workspace = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$workspacePattern = [regex]::Escape($workspace)

function Get-ListeningProcessIds([int]$Port) {
  $matches = netstat -ano -p TCP | Select-String -Pattern "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  return @($matches | ForEach-Object { [int]$_.Matches[0].Groups[1].Value } | Sort-Object -Unique)
}

function Get-ProcessRecord([int]$ProcessId) {
  return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

function Stop-ProjectProcess([int]$ProcessId) {
  $current = Get-ProcessRecord $ProcessId
  while ($current -and $current.CommandLine -match $workspacePattern) {
    $parent = Get-ProcessRecord ([int]$current.ParentProcessId)
    Stop-Process -Id ([int]$current.ProcessId) -Force -ErrorAction SilentlyContinue
    Write-Host "[STOPPED] PID $($current.ProcessId) from this workspace"
    $current = $parent
  }
}

foreach ($port in $Ports) {
  foreach ($processId in (Get-ListeningProcessIds $port)) {
    $process = Get-ProcessRecord $processId
    if (-not $process) { continue }
    if ($process.CommandLine -notmatch $workspacePattern) {
      Write-Error "Port $port is used by another program (PID $processId, $($process.Name)). Close it or change the template port."
    }
    Write-Host "[INFO] Replacing old template service on port $port (PID $processId)"
    Stop-ProjectProcess $processId
  }
}

Start-Sleep -Milliseconds 400
