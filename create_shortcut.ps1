$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\AI Gateway.lnk")
$Shortcut.TargetPath = "$env:USERPROFILE\code\ai-gateway\node_modules\electron\dist\electron.exe"
$Shortcut.Arguments = "."
$Shortcut.WorkingDirectory = "$env:USERPROFILE\code\ai-gateway"
$Shortcut.Description = "AI Gateway - Franz za AI"
$Shortcut.Save()
Write-Host "Shortcut created on Desktop"
