$projectRoot = Split-Path -Parent $PSScriptRoot
$ports = 3000, 5000, 5432

foreach ($port in $ports) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" |
      Select-Object -First 1 ProcessId, CommandLine

    $shouldStop = $false

    if ($process) {
      $shouldStop = $port -in 3000, 5000 -or
        $process.CommandLine -like "*$projectRoot*" -or
        $process.CommandLine -like "*pglite-server*"
    }

    if ($shouldStop) {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
      Write-Output "Stopped PID $($process.ProcessId) on port $port"
    }
  }
}
