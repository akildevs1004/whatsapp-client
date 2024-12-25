@echo off
:loop
    REM Run whatsapp-client-bulk.js in the background using node (only once at the beginning)
    start /b node whatsapp-client-bulk.js

    REM Wait for the application to start
    timeout /t 5 /nobreak >nul

    REM Get the process ID (PID) of the node process running whatsapp-client-bulk.js
    for /f "tokens=2" %%a in ('tasklist /fi "imagename eq node.exe" /fo csv') do set pid=%%~a

    :monitorMemory
    REM Get the memory usage of the process in KB
    for /f "tokens=5 delims=," %%b in ('tasklist /fi "PID eq %%pid%%" /fo csv') do set mem_usage=%%~b

    REM Convert memory usage to MB (divide by 1024)
    set /a mem_mb=%mem_usage% / 1024

    REM Print memory usage
    echo Memory usage: %mem_mb% MB

    REM Wait for 1 second before checking again
    timeout /t 1 /nobreak >nul

    REM If memory exceeds 100 MB, kill the process and restart it
    if %mem_mb% gtr 10 (
        echo Memory usage exceeded 10 MB, restarting process...
        taskkill /f /pid %%pid%%
        timeout /t 2 /nobreak >nul
        goto loop
    )

    REM Go back to monitoring memory
    goto monitorMemory
