@echo off
cd /d "%~dp0"
node scripts\build-android.mjs
if errorlevel 1 (
  echo No se genero el APK. Revisa el error mostrado arriba.
  pause
  exit /b 1
)
pause
