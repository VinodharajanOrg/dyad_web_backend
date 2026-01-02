# Windows Setup Guide

## Building the Optimized Image on Windows

### Prerequisites
- Install **Docker Desktop** OR **Podman Desktop** for Windows
- Ensure the container engine is running

### Method 1: PowerShell (Recommended)
```powershell
# Open PowerShell in the backend directory
.\scripts\build-optimized-image.ps1
```

### Method 2: Command Prompt
```cmd
# Open Command Prompt in the backend directory
scripts\build-optimized-image.bat
```

### Method 3: Manual Build
```powershell
# With Podman
podman build -f Dockerfile.vite-dev -t dyad-vite-dev:latest .

# With Docker
docker build -f Dockerfile.vite-dev -t dyad-vite-dev:latest .
```

## Configuration

After building, update your `.env` file:
```env
PODMAN_IMAGE=dyad-vite-dev:latest
# or
DOCKER_IMAGE=dyad-vite-dev:latest
```

## Running the Backend

```powershell
npm run dev
```

## Troubleshooting

### "Execution Policy" Error (PowerShell)
If you get an execution policy error:
```powershell
# Allow script execution for current session
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# Then run the script again
.\scripts\build-optimized-image.ps1
```

### Docker/Podman Not Found
- **Docker Desktop**: Download from https://www.docker.com/products/docker-desktop
- **Podman Desktop**: Download from https://podman-desktop.io/downloads

### Build Fails with "Cannot Find File"
Make sure you're in the backend root directory:
```powershell
cd path\to\dyad_backend
# Then run the build script
.\scripts\build-optimized-image.ps1
```

### Network Issues During Build
If packages fail to download:
```powershell
# Check internet connection
# Retry the build - it will resume from cache
.\scripts\build-optimized-image.ps1
```

## Performance Expectations

After using the optimized image:
- **First container start**: 3-5 seconds (was 30-40s)
- **Container restart**: 2-3 seconds (was 5-10s)
- **90% reduction** in startup time!

## File Paths

Windows uses backslashes (`\`) for paths. In `.env` file:
```env
# Windows paths (use forward slashes or double backslashes)
APPS_BASE_DIR=./apps
# or
APPS_BASE_DIR=.\\apps
```

## Container Engine Notes

### Docker Desktop on Windows
- Uses WSL2 backend (recommended)
- File sharing must be enabled for your project directory
- Check Docker Desktop → Settings → Resources → File Sharing

### Podman Desktop on Windows
- Uses WSL2 backend
- Machine must be initialized and running
- Check Podman Desktop → Resources

## Next Steps

1. ✅ Build optimized image
2. ✅ Update `.env` file
3. ✅ Restart backend with `npm run dev`
4. ✅ Create a test app and watch it start in 3-5 seconds!

## Support

For more details, see:
- [Container Startup Optimization Guide](./CONTAINER_STARTUP_OPTIMIZATION.md)
- [Quick Start Guide](./CONTAINER_STARTUP_QUICKSTART.md)
