@echo off
REM Build optimized container image with pre-cached scaffold dependencies
REM This image provides near-instant container startup for new apps

echo ================================================
echo Building Optimized Vite Development Image
echo ================================================
echo.

REM Detect container engine
where podman >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set ENGINE=podman
    echo [✓] Using Podman
    goto :build
)

where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set ENGINE=docker
    echo [✓] Using Docker
    goto :build
)

echo [✗] Error: Neither Docker nor Podman found
echo Please install Docker Desktop or Podman Desktop for Windows
pause
exit /b 1

:build
set IMAGE_NAME=dyad-vite-dev:latest
set DOCKERFILE=Dockerfile.vite-dev

echo.
echo Building image: %IMAGE_NAME%
echo This will take 3-5 minutes (one-time setup)
echo.

REM Build the image
%ENGINE% build -f %DOCKERFILE% -t %IMAGE_NAME% .
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [✗] Build failed!
    pause
    exit /b 1
)

echo.
echo ================================================
echo [✓] Image built successfully!
echo ================================================
echo.
echo Next steps:
echo 1. Update your .env file:
echo    PODMAN_IMAGE=%IMAGE_NAME%
echo    (or DOCKER_IMAGE=%IMAGE_NAME%)
echo.
echo 2. Restart your backend:
echo    npm run dev
echo.
echo Expected performance:
echo   • First container start: ~3-5 seconds (was ~30-40s)
echo   • Container restart: ~2-3 seconds (was ~5-10s)
echo   • 90%% reduction in startup time!
echo.
pause
