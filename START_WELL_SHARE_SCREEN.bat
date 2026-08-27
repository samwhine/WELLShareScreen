@echo off
title WELL Share Screen
color 09

echo =====================================================
echo   WELL SHARE SCREEN
echo =====================================================
echo.

cd /d "%~dp0"
node server.js
