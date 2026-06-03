@echo off
setlocal

cd /d "%~dp0"
set PORT=8080

echo Serving NE Naught Project at http://localhost:%PORT%

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m http.server %PORT%
) else (
  python -m http.server %PORT%
)

pause
