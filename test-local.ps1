$proc = Start-Process node -ArgumentList server.js -PassThru -WindowStyle Hidden `
    -RedirectStandardOutput "$PSScriptRoot\test-stdout.txt" `
    -RedirectStandardError "$PSScriptRoot\test-stderr.txt"

Write-Host "Started node PID $($proc.Id), waiting 5s..."
Start-Sleep 5

$body = '{"message":"hello","sessionId":"local-test","modelKey":"gemini_flash"}'
try {
    $r = Invoke-RestMethod -Uri "http://localhost:4000/chat" -Method POST `
        -ContentType "application/json" -Body $body -TimeoutSec 20
    Write-Host "SUCCESS: ok=$($r.ok) stage=$($r.stage) score=$($r.leadScore)"
    Write-Host "REPLY: $($r.reply)"
} catch {
    Write-Host "REQUEST FAILED: $_"
}

Write-Host "--- STDOUT ---"
Get-Content "$PSScriptRoot\test-stdout.txt"
Write-Host "--- STDERR ---"
Get-Content "$PSScriptRoot\test-stderr.txt"

Stop-Process -Id $proc.Id -Force
