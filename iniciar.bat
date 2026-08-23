@echo off
setlocal
cd /d "%~dp0api"

if not exist node_modules (
    echo [FinanzasApp] Installing dependencies...
    call npm install
    if errorlevel 1 goto :error
)

echo [FinanzasApp] Syncing database schema...
call npx prisma generate
if errorlevel 1 goto :error
call npx prisma migrate deploy
if errorlevel 1 goto :error

echo [FinanzasApp] Starting server on http://localhost:3000 ...
start "" http://localhost:3000
call npm start
goto :eof

:error
echo [FinanzasApp] Failed to start. Check the output above.
pause
