@echo off
setlocal enabledelayedexpansion

rem ============================================================================
rem CURSOR AI TEMPLATE - SETUP SCRIPT (Windows)
rem ============================================================================

rem --- ANSI colors (Windows 10 1903+) ---
for /f "delims=" %%i in ('powershell -NoProfile -Command "[char]27"') do set "ESC=%%i"
set "GREEN=%ESC%[32m"
set "YELLOW=%ESC%[33m"
set "BLUE=%ESC%[34m"
set "NC=%ESC%[0m"

rem ============================================================================
rem BANNER
rem ============================================================================
echo.
echo  +-------------------------------------------+
echo  ^|   CURSOR AI TEMPLATE SETUP               ^|
echo  +-------------------------------------------+
echo.
echo %BLUE%[INFO]%NC% Platform: Windows
echo.

rem ============================================================================
rem 2. CREATE .env
rem ============================================================================
echo %BLUE%[INFO]%NC% Checking .env...

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo %GREEN%[OK]%NC% .env created from .env.example
        echo %YELLOW%[WARN]%NC% Edit .env - do NOT open in Cursor!
    ) else (
        echo %BLUE%[INFO]%NC% .env.example not found - creating template...
        (
            echo # Example environment variables
            echo # APP_ENV=development
            echo # DATABASE_URL=postgresql://user:password@localhost:5432/dbname
            echo # SECRET_KEY=changeme
        ) > ".env.example"
        copy ".env.example" ".env" >nul
        echo %GREEN%[OK]%NC% .env.example and .env created
        echo %YELLOW%[WARN]%NC% Fill in variables in .env before starting the project
    )
) else (
    echo %GREEN%[OK]%NC% .env already exists
)

rem ============================================================================
rem 3. CURSOR PRIVACY MODE
rem ============================================================================
echo %BLUE%[INFO]%NC% Configuring Cursor Privacy Mode...

set "CURSOR_DIR=%APPDATA%\Cursor\User"
set "CURSOR_SETTINGS=%CURSOR_DIR%\settings.json"
set "CURSOR_BACKUP=%CURSOR_DIR%\settings.json.bak"

echo %BLUE%[INFO]%NC% Settings path: %CURSOR_SETTINGS%

if not exist "%CURSOR_DIR%" mkdir "%CURSOR_DIR%"

if exist "%CURSOR_SETTINGS%" (
    copy "%CURSOR_SETTINGS%" "%CURSOR_BACKUP%" >nul
    echo %BLUE%[INFO]%NC% Backup saved: %CURSOR_BACKUP%
)

(
    echo {
    echo   "cursor.privacyMode": true,
    echo   "cursor.ghostMode": true,
    echo   "cursor.autoRun": false,
    echo   "telemetry.telemetryLevel": "off",
    echo   "telemetry.enableCrashReporter": false,
    echo   "telemetry.enableTelemetry": false,
    echo   "http.disableHTTP2": true
    echo }
) > "%CURSOR_SETTINGS%"

echo %GREEN%[OK]%NC% Cursor settings applied
echo %YELLOW%[WARN]%NC% Restart Cursor IDE to apply settings

rem ============================================================================
rem DONE
rem ============================================================================
echo.
echo  +-------------------------------------------+
echo  ^|   SETUP COMPLETE!                        ^|
echo  +-------------------------------------------+
echo.
echo Next steps:
echo   1. Edit .env         -^> notepad .env
echo   2. Close Cursor, then reopen the project
echo   3. DevContainer  -^> Ctrl + Shift + P -^> 'Open Folder in Container'
echo.

pause
endlocal
