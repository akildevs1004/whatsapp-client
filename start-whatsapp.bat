@echo off
setlocal enabledelayedexpansion

REM Memory usage threshold in MB
set mem_threshold=100
set log_file=script_log.txt

REM Function to log messages
:log
echo [%date% %time%] %~1 >> %log_file%
exit /b

:loop
REM Start the Node.js app in the background
start /b node whatsapp-client.js
timeout /t 5 /nobreak >nul

REM Get the PID of the running Node.js process
set "pid="
for /f "tokens=2 delims=," %%a in ('tasklist /fi "imagename eq node.exe" /fo csv ^| find /i "node.exe"') do set "pid=%%~a"

if not defined pid (
    call :log "ERROR: Node.js process not found. Retrying..."
    timeout /t 2 /nobreak >nul
    goto loop
)

call :log "Node.js process started with PID: %pid%"

:monitor
REM Check if the process is still running
tasklist /fi "PID eq %pid%" | find /i "%pid%" >nul
if errorlevel 1 (
    call :log "WARNING: Process stopped unexpectedly. Restarting..."
    timeout /t 2 /nobreak >nul
    goto loop
)

REM Check memory usage
if exist memory.log (
    for /f "delims=" %%b in ('type memory.log') do set "mem_usage=%%b"

    REM Ensure mem_usage is not empty
    if not defined mem_usage (
        call :log "ERROR: memory.log is empty or invalid. Skipping memory check."
        timeout /t 1 /nobreak >nul
        goto monitor
    )

    set "mem_usage=%mem_usage:,=%"  REM Remove commas if present

    REM Validate numeric memory usage
    for /f "delims=0123456789" %%c in ("!mem_usage!") do (
        call :log "ERROR: Invalid memory usage format in memory.log. Value: !mem_usage!"
        goto monitor
    )

    echo Current Heap Memory Usage: %mem_usage% MB
    call :log "Current Heap Memory Usage: %mem_usage% MB"

    REM Check if memory usage exceeds threshold
    if !mem_usage! gtr %mem_threshold% (
        call :log "WARNING: Heap memory exceeded %mem_threshold% MB. Restarting process..."
        taskkill /f /pid %pid% >nul 2>&1
        timeout /t 2 /nobreak >nul
        goto loop
    )
) else (
    call :log "WARNING: memory.log not found. Skipping memory check."
)

REM Wait 1 minute before rechecking
timeout /t 60 /nobreak >nul
goto monitor
