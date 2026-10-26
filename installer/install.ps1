# AeroGraph One-Click Local Installer
# Installs AeroGraph to %LOCALAPPDATA%\Programs\AeroGraph without requiring admin rights.

$ErrorActionPreference = "Stop"

$installDir = "$env:LOCALAPPDATA\Programs\AeroGraph"
$sourceDir = Resolve-Path "$PSScriptRoot\.."

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Installing AeroGraph to: $installDir" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Stop any currently running AeroGraph
Get-Process AeroGraph -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# 2. Create destination directories
New-Item -ItemType Directory -Path "$installDir\assets" -Force | Out-Null

# 3. Copy Executable and Icons
Copy-Item "$sourceDir\AeroGraph.exe" "$installDir\AeroGraph.exe" -Force
Copy-Item "$sourceDir\icon.ico" "$installDir\icon.ico" -Force
Copy-Item "$sourceDir\icon.png" "$installDir\icon.png" -Force

# 4. Copy Assets recursively
Write-Host "Deploying assets (Databases, Maps, Charts, Voice Profiles)..." -ForegroundColor Yellow
robocopy "$sourceDir\assets" "$installDir\assets" /E /NFL /NDL /NJH /NJS

# 5. Create Desktop Shortcut
$wsh = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcut = $wsh.CreateShortcut("$desktopPath\AeroGraph.lnk")
$shortcut.TargetPath = "$installDir\AeroGraph.exe"
$shortcut.WorkingDirectory = $installDir
$shortcut.IconLocation = "$installDir\icon.ico, 0"
$shortcut.Description = "AeroGraph - Falcon BMS Voice & Kneeboards"
$shortcut.Save()

# 6. Create Start Menu Shortcut
$startMenuPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\AeroGraph"
New-Item -ItemType Directory -Path $startMenuPath -Force | Out-Null
$startShortcut = $wsh.CreateShortcut("$startMenuPath\AeroGraph.lnk")
$startShortcut.TargetPath = "$installDir\AeroGraph.exe"
$startShortcut.WorkingDirectory = $installDir
$startShortcut.IconLocation = "$installDir\icon.ico, 0"
$startShortcut.Description = "AeroGraph - Falcon BMS Voice & Kneeboards"
$startShortcut.Save()

Write-Host ""
Write-Host "✅ Installation completed successfully!" -ForegroundColor Green
Write-Host "Shortcut created on Desktop and Start Menu." -ForegroundColor Green
Write-Host "Location: $installDir\AeroGraph.exe" -ForegroundColor Gray
Write-Host ""
