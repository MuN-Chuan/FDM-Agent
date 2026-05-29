@echo off
echo ==============================
echo   FDM-AI Dev Server
echo ==============================
echo.

echo [1/3] Backend on port 8001
start "FDM-Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001"
timeout /t 1 /nobreak >nul

echo [2/3] Frontend on port 5173
start "FDM-Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 1 /nobreak >nul

echo [3/3] Agent on port 7890
start "FDM-Agent" cmd /k "cd /d %~dp0client-agent && node src/index.js"

echo.
echo All services started:
echo   Backend:      http://localhost:8001
echo   Frontend:     http://localhost:5173
echo   Client Agent: ws://localhost:7890
echo.
pause
