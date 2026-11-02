<#
.SYNOPSIS
    AeroGraph Automated Release & Installer Builder
.DESCRIPTION
    Compiles AeroGraph in release mode and packages it into a single standalone
    graphical Windows setup executable (AeroGraph_Setup_vX.Y.Z.exe) using Inno Setup.
.PARAMETER Version
    Optional version string override (e.g. "0.9.9-test"). If omitted, reads from Cargo.toml.
#>

param(
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path "$scriptDir\.."
Set-Location $projectRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         AeroGraph Automated Installer Builder            " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Resolve package version
if (-not $Version) {
    $cargoTomlPath = "$projectRoot\Cargo.toml"
    if (-not (Test-Path $cargoTomlPath)) {
        Write-Error "Cargo.toml not found at $cargoTomlPath"
    }

    $cargoToml = Get-Content $cargoTomlPath -Raw
    if ($cargoToml -match 'version\s*=\s*"([^"]+)"') {
        $Version = $Matches[1]
        Write-Host "Detected AeroGraph Version from Cargo.toml: v$Version" -ForegroundColor Green
    } else {
        $Version = "0.1.0"
        Write-Host "Could not detect version from Cargo.toml, defaulting to v$Version" -ForegroundColor Yellow
    }
} else {
    Write-Host "Using Custom AeroGraph Version: v$Version" -ForegroundColor Cyan
}

# 2. Build release binary with Cargo
Write-Host "`n[1/3] Building AeroGraph release binary with Cargo..." -ForegroundColor Yellow
cargo build --release
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cargo build failed with exit code $LASTEXITCODE"
}
$releaseExe = "$projectRoot\target\release\AeroGraph.exe"
if (-not (Test-Path $releaseExe)) {
    Write-Error "Release executable not found at $releaseExe"
}
Write-Host "Executable built successfully: $releaseExe" -ForegroundColor Green

# 3. Locate Inno Setup Compiler (ISCC.exe)
Write-Host "`n[2/3] Locating Inno Setup Compiler (ISCC.exe)..." -ForegroundColor Yellow

function Find-ISCC {
    # Check PATH
    $cmd = Get-Command iscc -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # Check common installation directories
    $candidates = @(
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 7\ISCC.exe",
        "${env:ProgramFiles}\Inno Setup 7\ISCC.exe",
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe"
    )
    foreach ($cand in $candidates) {
        if (Test-Path $cand) { return $cand }
    }
    return $null
}

$isccPath = Find-ISCC

if (-not $isccPath) {
    Write-Host "ISCC.exe not found. Attempting automatic installation via winget..." -ForegroundColor Yellow
    try {
        winget install --id JRSoftware.InnoSetup -e --source winget --accept-source-agreements --accept-package-agreements
        $isccPath = Find-ISCC
    } catch {
        Write-Warning "winget installation encountered an error: $_"
    }
}

if (-not $isccPath) {
    Write-Host ""
    Write-Host "❌ Inno Setup Compiler (ISCC.exe) could not be located." -ForegroundColor Red
    Write-Host "Please install Inno Setup 6 manually to compile the graphical setup installer:" -ForegroundColor Yellow
    Write-Host "  Official Download: https://jrsoftware.org/isdl.php" -ForegroundColor Cyan
    Write-Host "  Or via PowerShell: winget install JRSoftware.InnoSetup" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "Found Inno Setup Compiler at: $isccPath" -ForegroundColor Green

# 4. Compile setup.iss
Write-Host "`n[3/3] Compiling standalone graphical setup installer..." -ForegroundColor Yellow
$setupScript = "$scriptDir\setup.iss"
$outputDir = "$scriptDir\output"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

& $isccPath "/DMyAppVersion=$Version" $setupScript
if ($LASTEXITCODE -ne 0) {
    Write-Error "Inno Setup compilation failed with exit code $LASTEXITCODE"
}

$setupExe = "$outputDir\AeroGraph_Setup_v$Version.exe"
if (Test-Path $setupExe) {
    $sizeMB = [math]::Round((Get-Item $setupExe).Length / 1MB, 2)
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  SUCCESS: Standalone graphical installer created!         " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Installer: $setupExe" -ForegroundColor Cyan
    Write-Host "Size:      $sizeMB MB" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Error "Installer compilation finished but output file $setupExe was not found."
}
