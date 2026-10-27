@echo off
REM Windows: instala dependencias (solo la primera vez) y arranca la plataforma.
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist dist call npm run build
call npm start
