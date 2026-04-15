param(
  [string]$Mode = "WaitBackend",
  [string]$Url = "http://localhost:3000",
  [int]$TimeoutSeconds = 60
)

if ($Mode -eq "WaitBackend") {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  Write-Host "[WAIT] Backend-Check gegen $Url"
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        Write-Host "[OK] Backend erreichbar."
        exit 0
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  Write-Host "[FEHLER] Backend Health nicht bestaetigt."
  exit 1
}

Write-Host "[INFO] Kein gueltiger Mode uebergeben."
exit 1
