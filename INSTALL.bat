@echo off
title INSTALL - WELL Share Screen
color 0A

echo.
echo =====================================================
echo   WELL SHARE SCREEN
echo   Installer / Setup
echo =====================================================
echo.

:: Cek apakah Node.js terinstall
node -v >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js tidak ditemukan!
    echo.
    echo Silakan install Node.js terlebih dahulu:
    echo https://nodejs.org  ^(pilih versi LTS^)
    echo.
    echo Setelah install Node.js, jalankan INSTALL.bat lagi.
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js ditemukan:
node -v
echo.

:: Pindah ke folder project
cd /d "%~dp0"

echo [INFO] Menginstall dependencies...
echo.
npm install

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] npm install gagal. Periksa koneksi internet kamu.
    echo.
    pause
    exit /b 1
)

echo.
color 0A
echo =====================================================
echo   Install selesai!
echo.
echo   Sekarang jalankan: START_WELL_SHARE_SCREEN.bat
echo =====================================================
echo.
pause
