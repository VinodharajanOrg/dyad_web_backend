# Build optimized container image with pre-cached scaffold dependencies
# This image provides near-instant container startup for new apps

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Building Optimized Vite Development Image" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Detect container engine
$ENGINE = $null

if (Get-Command podman -ErrorAction SilentlyContinue) {
    $ENGINE = "podman"
    Write-Host "✓ Using Podman" -ForegroundColor Green
}
elseif (Get-Command docker -ErrorAction SilentlyContinue) {
    $ENGINE = "docker"
    Write-Host "✓ Using Docker" -ForegroundColor Green
}
else {
    Write-Host "✗ Error: Neither Docker nor Podman found" -ForegroundColor Red
    Write-Host "Please install Docker Desktop or Podman Desktop for Windows" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

$IMAGE_NAME = "dyad-vite-dev:latest"
$DOCKERFILE = "Dockerfile.vite-dev"

Write-Host ""
Write-Host "Building image: $IMAGE_NAME" -ForegroundColor Yellow
Write-Host "This will take 3-5 minutes (one-time setup)" -ForegroundColor Yellow
Write-Host ""

# Build the image
& $ENGINE build -f $DOCKERFILE -t $IMAGE_NAME .

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "✗ Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "✓ Image built successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update your .env file:" -ForegroundColor White
Write-Host "   PODMAN_IMAGE=$IMAGE_NAME" -ForegroundColor Gray
Write-Host "   (or DOCKER_IMAGE=$IMAGE_NAME)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Restart your backend:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Expected performance:" -ForegroundColor Cyan
Write-Host "  • First container start: ~3-5 seconds (was ~30-40s)" -ForegroundColor White
Write-Host "  • Container restart: ~2-3 seconds (was ~5-10s)" -ForegroundColor White
Write-Host "  • 90% reduction in startup time!" -ForegroundColor White
Write-Host ""
Read-Host "Press Enter to exit"
