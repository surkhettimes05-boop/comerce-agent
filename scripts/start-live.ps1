param (
  [int]$FrontendPort = 3000
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"
$frontendPath = Join-Path $projectRoot "frontend"
$npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
$pglitePath = Join-Path $backendPath "node_modules\.bin\pglite-server.cmd"

function Assert-PortAvailable {
  param (
    [int]$Port
  )

  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 OwningProcess

  if ($listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" |
      Select-Object -First 1 ProcessId, Name, CommandLine

    $details = if ($process) {
      "$($process.Name) ($($process.ProcessId)): $($process.CommandLine)"
    } else {
      "PID $($listener.OwningProcess)"
    }

    throw "Port $Port is already in use by $details"
  }
}

function Test-PortListening {
  param (
    [int]$Port
  )

  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1 OwningProcess

  return $null -ne $listener
}

function Wait-ForPort {
  param (
    [int]$Port,
    [int]$Attempts = 60
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    if (Test-PortListening -Port $Port) {
      return
    }

    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for port $Port"
}

function Wait-ForHttpOk {
  param (
    [string]$Url,
    [int]$Attempts = 60
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    Start-Sleep -Seconds 2

    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url

      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return
      }
    } catch {
    }
  }

  throw "Timed out waiting for $Url"
}

Assert-PortAvailable -Port 5000
Assert-PortAvailable -Port $FrontendPort

$pgliteOutLog = Join-Path $backendPath "pglite.out.log"
$pgliteErrLog = Join-Path $backendPath "pglite.err.log"
$backendOutLog = Join-Path $backendPath "live-backend.out.log"
$backendErrLog = Join-Path $backendPath "live-backend.err.log"
$frontendOutLog = Join-Path $frontendPath "live-frontend.out.log"
$frontendErrLog = Join-Path $frontendPath "live-frontend.err.log"

Remove-Item -LiteralPath $pgliteOutLog, $pgliteErrLog, $backendOutLog, $backendErrLog, $frontendOutLog, $frontendErrLog -ErrorAction SilentlyContinue

$pgliteProcess = $null

if (-not (Test-PortListening -Port 5432)) {
  if (-not (Test-Path -LiteralPath $pglitePath)) {
    throw "No PostgreSQL listener found on port 5432 and pglite-server is missing. Run npm install in $backendPath."
  }

  $pgliteProcess = Start-Process `
    -FilePath $pglitePath `
    -ArgumentList @("--db", ".\.pglite", "--host", "127.0.0.1", "--port", "5432", "--max-connections", "20") `
    -WorkingDirectory $backendPath `
    -WindowStyle Hidden `
    -RedirectStandardOutput $pgliteOutLog `
    -RedirectStandardError $pgliteErrLog `
    -PassThru

  Wait-ForPort -Port 5432
}

& $npmPath run db:sync --prefix $backendPath

if ($LASTEXITCODE -ne 0) {
  if ($pgliteProcess) {
    Stop-Process -Id $pgliteProcess.Id -Force -ErrorAction SilentlyContinue
  }

  throw "Database sync failed."
}

$backendProcess = Start-Process `
  -FilePath $npmPath `
  -ArgumentList @("start") `
  -WorkingDirectory $backendPath `
  -WindowStyle Hidden `
  -RedirectStandardOutput $backendOutLog `
  -RedirectStandardError $backendErrLog `
  -PassThru

$frontendProcess = Start-Process `
  -FilePath $npmPath `
  -ArgumentList @("start", "--", "--hostname", "0.0.0.0", "--port", "$FrontendPort") `
  -WorkingDirectory $frontendPath `
  -WindowStyle Hidden `
  -RedirectStandardOutput $frontendOutLog `
  -RedirectStandardError $frontendErrLog `
  -PassThru

try {
  Wait-ForHttpOk -Url "http://127.0.0.1:5000/health"
  Wait-ForHttpOk -Url "http://127.0.0.1:$FrontendPort/admin"
} catch {
  foreach ($processId in @($backendProcess.Id, $frontendProcess.Id)) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }

  if ($pgliteProcess) {
    Stop-Process -Id $pgliteProcess.Id -Force -ErrorAction SilentlyContinue
  }

  throw
}

Write-Output "Backend PID: $($backendProcess.Id)"
Write-Output "Frontend PID: $($frontendProcess.Id)"
if ($pgliteProcess) {
  Write-Output "PGlite PID: $($pgliteProcess.Id)"
}
Write-Output "Chat: http://localhost:$FrontendPort/chat"
Write-Output "Admin: http://localhost:$FrontendPort/admin"
