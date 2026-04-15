@echo off
setlocal
set SCRIPT_DIR=%~dp0
if "%SCRIPT_DIR:~-1%"=="\" set SCRIPT_DIR=%SCRIPT_DIR:~0,-1%
set ROOT_DIR=%SCRIPT_DIR%\..\..\..
for %%I in ("%ROOT_DIR%") do set ROOT_DIR=%%~fI
call "%ROOT_DIR%\KI-OS-Start.bat"
endlocal
