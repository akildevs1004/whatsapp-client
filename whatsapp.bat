@ECHO OFF

@REM for frontend   
@set PATH=nodejs;%PATH%
 

 :: Run the server, display output, and save to log (PowerShell needed)
 :: powershell -Command "node server.js | Tee-Object -FilePath 'server.log'"

 :: powershell -Command "node backgroundserver.js 2>&1 | Out-File -FilePath 'server.log'"

node whatsapp-client.js