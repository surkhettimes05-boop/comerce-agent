$projectRoot = Split-Path -Parent $PSScriptRoot
$ports = 3000, 5000

foreach ($port in $ports) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" |
      Select-Object -First 1 ProcessId, CommandLine

    if ($process -and $process.CommandLine -like "*$projectRoot*") {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
      Write-Output "Stopped PID $($process.ProcessId) on port $port"
    }
  }
}
