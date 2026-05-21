$scriptPath = Join-Path $PSScriptRoot "start-server.vbs"
$batPath = Join-Path $PSScriptRoot "start-server.bat"

# Create VBS script (runs hidden)
@"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c `"$batPath`"", 0, False
"@ | Set-Content -Path $scriptPath -Encoding ASCII

# Add to Startup folder
$startupPath = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$shortcutPath = Join-Path $startupPath "TOIR-server.lnk"

$WScriptShell = New-Object -ComObject WScript.Shell
$shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$scriptPath`""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = "TOIR - сервер заявок на ремонт"
$shortcut.Save()

Write-Host "Готово! Сервер будет запускаться автоматически при входе в Windows."
Write-Host "Ярлык: $shortcutPath"
Write-Host ""
Write-Host "Для запуска сейчас выполните: start-server.bat"
Write-Host "Для открытия приложения: http://localhost:8080"
