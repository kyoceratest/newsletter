@echo off
REM One-click sync for Moosend template from index.html
REM Run this file by double-clicking it.

setlocal EnableExtensions EnableDelayedExpansion

REM Change to script directory
cd /d "%~dp0"

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo [sync_moosend] Node.js not found. Please install Node.js from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

REM Run the sync script
node "sync_moosend.js"
set ERR=%ERRORLEVEL%

if %ERR% neq 0 (
  echo [sync_moosend] Sync failed with exit code %ERR%.
  pause
  exit /b %ERR%
) else (
  echo [sync_moosend] Sync completed successfully.
  echo Updated: moosend_template.html
  pause
  exit /b 0
)
