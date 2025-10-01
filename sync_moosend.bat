@echo off
REM One-click sync for Moosend template from index.html
REM Run this file by double-clicking it.

setlocal EnableExtensions EnableDelayedExpansion

REM Change to script directory
cd /d "%~dp0"

REM Prefer PowerShell sync (updates header + tiles + purges CDN). Fallback to Node if PS not available.

where powershell >nul 2>nul
if %ERRORLEVEL%==0 (
  powershell -ExecutionPolicy Bypass -File ".\sync_moosend.ps1"
  set ERR=%ERRORLEVEL%
  if %ERR% neq 0 (
    echo [sync_moosend] PowerShell sync failed with exit code %ERR%. Trying Node fallback...
    goto :NODE_FALLBACK
  ) else (
    echo [sync_moosend] Sync completed successfully via PowerShell.
    echo Updated: moosend_template.html
    pause
    exit /b 0
  )
) else (
  echo [sync_moosend] PowerShell not found. Trying Node fallback...
  goto :NODE_FALLBACK
)

:NODE_FALLBACK
where node >nul 2>nul
if errorlevel 1 (
  echo [sync_moosend] Node.js not found. Please install Node.js from https://nodejs.org/ or run sync_moosend.ps1 manually.
  pause
  exit /b 1
)

node "sync_moosend.js"
set ERR=%ERRORLEVEL%
if %ERR% neq 0 (
  echo [sync_moosend] Node sync failed with exit code %ERR%.
  pause
  exit /b %ERR%
) else (
  echo [sync_moosend] Sync completed successfully via Node.
  echo Updated (header only): moosend_template.html
  pause
  exit /b 0
)
