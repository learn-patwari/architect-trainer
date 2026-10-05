<#
  Starts Architect Trainer and opens it in your browser.

  Launched by start.cmd. Run it directly with:
    powershell -ExecutionPolicy Bypass -File tools\start.ps1
#>

param(
  # Skip opening a browser window, e.g. when you already have the tab open.
  [switch] $NoBrowser
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$port = 5379
$url = "http://localhost:$port"

# A plain TCP connect, not a web request: no proxy auto-detection to wait on.
function Test-TrainerUp {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', $port)
    return $client.Connected
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Stop-WithMessage {
  param([string] $Message)
  Write-Host ''
  Write-Host $Message -ForegroundColor Red
  Write-Host ''
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Stop-WithMessage 'Node.js is not on your PATH. Install Node 20 or newer from https://nodejs.org, then run this again.'
}

# Already running? Bring that one up instead of fighting over the port.
if (Test-TrainerUp) {
  Write-Host "The trainer is already running. Opening $url"
  if (-not $NoBrowser) { Start-Process $url }
  exit 0
}

if (-not (Test-Path 'node_modules')) {
  Write-Host 'First run: installing dependencies. This takes a minute...'
  & npm install
  if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'npm install failed - see the messages above.' }
}

# Rebuild the UI only when something it is built from has changed.
$needBuild = $true
$built = 'dist\web\index.html'
if (Test-Path $built) {
  $builtAt = (Get-Item $built).LastWriteTimeUtc
  $sources = @('web', 'shared', 'vite.config.ts', 'package.json', 'tsconfig.json')
  $newer = Get-ChildItem -Path $sources -File -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTimeUtc -gt $builtAt } |
    Select-Object -First 1
  $needBuild = [bool] $newer
}

Write-Host "Starting Architect Trainer on $url"
Write-Host 'Leave this window open while you train; closing it stops the server.'
Write-Host ''

# Open the browser the moment the server answers, without holding up the build.
if (-not $NoBrowser) {
  $opener = @"
for (`$i = 0; `$i -lt 240; `$i++) {
  `$c = New-Object System.Net.Sockets.TcpClient
  try {
    `$c.Connect('127.0.0.1', $port)
    if (`$c.Connected) { `$c.Close(); Start-Process '$url'; break }
  } catch {
    Start-Sleep -Milliseconds 500
  } finally {
    `$c.Close()
  }
}
"@
  Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @('-NoProfile', '-Command', $opener) | Out-Null
}

if ($needBuild) {
  Write-Host 'Building the UI...'
  & npm start
} else {
  Write-Host 'UI is up to date - skipping the rebuild.'
  & (Join-Path $root 'node_modules\.bin\tsx.cmd') server/index.ts
}

$code = $LASTEXITCODE
Write-Host ''
if ($code -ne 0) {
  Write-Host "The server stopped with exit code $code." -ForegroundColor Red
} else {
  Write-Host 'The server stopped.'
}
exit $code
