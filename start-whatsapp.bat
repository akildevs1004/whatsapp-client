@echo off
setlocal enabledelayedexpansion

REM Memory usage threshold in MB
set mem_threshold=100

:loop
REM Start the Node.js app in the background
start /b node whatsapp-client.js
timeout /t 5 /nobreak >nul

REM Get the PID of the running Node.js process
for /f "tokens=2 delims=," %%a in ('tasklist /fi "imagename eq node.exe" /fo csv ^| find /i "node.exe"') do set "pid=%%~a"

if not defined pid (
    echo Node.js process not found. Retrying...
    timeout /t 2 /nobreak >nul
    goto loop
)

echo Monitoring process with PID: %pid%

:monitor
REM Check if the process is still running every minute
tasklist /fi "PID eq %pid%" | find /i "%pid%" >nul
if errorlevel 1 (
    echo Process stopped unexpectedly. Restarting...
    timeout /t 2 /nobreak >nul
    goto loop
)

REM Check memory usage
if exist memory.log (
    for /f "delims=" %%b in ('type memory.log') do set "mem_usage=%%b"

    REM Ensure mem_usage is not empty
    if not defined mem_usage (
        echo WARNING: memory.log is empty or invalid.
        timeout /t 1 /nobreak >nul
        goto monitor
    )

    set "mem_usage=%mem_usage:,=%"  REM Remove commas if present
    echo Current Heap Memory Usage:  %mem_usage% !mem_usage! MB

    REM Check if memory usage exceeds threshold
    if !mem_usage! gtr %mem_threshold% (
        echo WARNING: Heap memory exceeded %mem_threshold% MB. Restarting process...
        taskkill /f /pid %pid% >nul 2>&1
        timeout /t 2 /nobreak >nul
        goto loop
    )
) else (
    echo WARNING: memory.log not found. Skipping memory check.
)

REM Wait 1 minute before rechecking
timeout /t 60 /nobreak >nul
goto monitor
