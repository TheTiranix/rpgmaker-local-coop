@echo off
if "%~1"=="" (
  echo Arrastra la carpeta del juego sobre este archivo, o usa: install.bat "C:\ruta\al\juego"
  pause & exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" -GamePath "%~1"
pause
