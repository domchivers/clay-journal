@echo off
REM Double-click to run Clay Journal. Keep this window open while you use it.
cd /d "%~dp0"
echo.
echo   On THIS computer:   http://localhost:8011/index.html
echo.
echo   On your phone (same Wi-Fi), open the browser and go to:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo      http:/%%a:8011/index.html
echo.
start "" http://localhost:8011/index.html
python -m http.server 8011
