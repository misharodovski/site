@echo off
chcp 65001 >nul
title Istaya Kuznica - add photos
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\add-photos.ps1" -Site "%~dp0."
echo.
pause
