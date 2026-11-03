<#
.SYNOPSIS
    AeroGraph Pre-Flight Quality Check
.DESCRIPTION
    Runs automated formatting (cargo fmt), Clippy lints (cargo clippy -- -D warnings),
    and the full unit test suite (cargo test). Run this before pushing branches or opening PRs.
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path "$scriptDir\.."
Set-Location $projectRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         AeroGraph Pre-Flight Quality Check               " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Code Formatting (auto-format in-place)
Write-Host "`n[1/3] Formatting Rust source code (cargo fmt)..." -ForegroundColor Yellow
cargo fmt
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ cargo fmt encountered an error." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✔ Code formatting completed." -ForegroundColor Green

# 2. Clippy Lints (enforce zero warnings)
Write-Host "`n[2/3] Running Clippy lints (cargo clippy -- -D warnings)..." -ForegroundColor Yellow
cargo clippy -- -D warnings
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Clippy found lint warnings or compiler errors." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✔ Clippy checks passed with 0 warnings." -ForegroundColor Green

# 3. Unit Tests
Write-Host "`n[3/3] Running test suite (cargo test)..." -ForegroundColor Yellow
cargo test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Unit tests failed." -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "✔ All unit tests passed cleanly." -ForegroundColor Green

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  ALL PRE-FLIGHT CHECKS PASSED! Ready for PR submission.  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
