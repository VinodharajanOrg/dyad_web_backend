/**
 * Common app command builder utility
 * Shared between container and local execution modes
 */

import * as fs from 'fs';
import * as path from 'path';

export type PackageManager = 'pnpm' | 'npm' | 'yarn';

/**
 * Detect which package manager to use based on lock files
 * Falls back to DEFAULT_PACKAGE_MANAGER env variable (default: pnpm)
 */
export function detectPackageManager(appPath: string): PackageManager {
    if (fs.existsSync(path.join(appPath, 'pnpm-lock.yaml'))) {
        return 'pnpm';
    }
    if (fs.existsSync(path.join(appPath, 'yarn.lock'))) {
        return 'yarn';
    }
    if (fs.existsSync(path.join(appPath, 'package-lock.json'))) {
        return 'npm';
    }
    
    // Use environment variable or default to pnpm
    const defaultPm = process.env.DEFAULT_PACKAGE_MANAGER as PackageManager;
    return defaultPm === 'npm' || defaultPm === 'yarn' || defaultPm === 'pnpm' ? defaultPm : 'pnpm';
}

/**
 * Build the install command based on package manager
 */
export function getInstallCommand(packageManager: PackageManager): string {
    switch (packageManager) {
        case 'pnpm':
            return 'pnpm install';
        case 'yarn':
            return 'yarn install';
        case 'npm':
        default:
            return 'npm install --legacy-peer-deps';
    }
}

/**
 * Build the dev server start command based on package manager
 */
export function getDevCommand(packageManager: PackageManager, port: number): string {
    switch (packageManager) {
        case 'pnpm':
            return `pnpm run dev --host 0.0.0.0 --port ${port}`;
        case 'yarn':
            return `yarn dev --host 0.0.0.0 --port ${port}`;
        case 'npm':
        default:
            return `npm run dev -- --host 0.0.0.0 --port ${port}`;
    }
}

/**
 * Build the complete startup command (install + dev)
 * This is the main command used by both containers and local execution
 */
export function getAppStartupCommand(appPath: string, port: number): string {
    const pm = detectPackageManager(appPath);
    const installCmd = getInstallCommand(pm);
    const devCmd = getDevCommand(pm, port);

    return `${installCmd} && ${devCmd}`;
}

/**
 * Get startup script for containers (includes environment setup and smart caching)
 * Used by container handlers (Docker, Podman, etc.)
 * 
 * OPTIMIZATION: Only reinstalls dependencies when package.json changes
 * This reduces startup time from ~90s to ~5-10s on restarts
 */
export function getContainerStartupScript(appPath: string, port: number): string {
    const pm = detectPackageManager(appPath);
    const devCmd = getDevCommand(pm, port);

    // Build install command based on package manager (no clean install)
    let installCmd: string;
    if (pm === 'npm') {
        installCmd = 'npm install --legacy-peer-deps';
    } else if (pm === 'pnpm') {
        installCmd = 'pnpm install';
    } else {
        installCmd = 'yarn install';
    }

    return `#!/bin/sh
set -e

echo "[INFO] Container starting for port ${port}..."
START_TIME=$(date +%s)

# Check if dependencies need to be installed
NEEDS_INSTALL=false

if [ ! -d "node_modules" ]; then
    echo "[INFO] No node_modules found, will install dependencies"
    NEEDS_INSTALL=true
elif [ ! -f ".dependency-hash" ]; then
    echo "[INFO] No dependency hash found, will install dependencies"
    NEEDS_INSTALL=true
else
    # Compare package.json hash with stored hash
    CURRENT_HASH=$(md5sum package.json 2>/dev/null | cut -d' ' -f1 || echo "none")
    STORED_HASH=$(cat .dependency-hash 2>/dev/null || echo "none")
    
    if [ "$CURRENT_HASH" != "$STORED_HASH" ]; then
        echo "[INFO] package.json changed, will reinstall dependencies"
        echo "[DEBUG] Current hash: $CURRENT_HASH, Stored hash: $STORED_HASH"
        NEEDS_INSTALL=true
    else
        echo "[INFO] Dependencies up-to-date (hash: $CURRENT_HASH), skipping install"
    fi
fi

# Install dependencies only if needed
if [ "$NEEDS_INSTALL" = true ]; then
    INSTALL_START=$(date +%s)
    echo "[INFO] Installing dependencies with ${pm}..."
    
    # Ensure package manager is available
    corepack enable 2>/dev/null || true
    corepack prepare pnpm@latest --activate 2>/dev/null || true
    
    ${installCmd}
    
    # Store hash for future comparison
    md5sum package.json 2>/dev/null | cut -d' ' -f1 > .dependency-hash || true
    
    INSTALL_END=$(date +%s)
    INSTALL_TIME=$((INSTALL_END - INSTALL_START))
    echo "[INFO] Dependencies installed successfully in \${INSTALL_TIME}s"
else
    echo "[INFO] Using cached dependencies, skipping installation"
fi

echo "[INFO] Starting dev server on port ${port}..."
if [ ! -f package.json ]; then
    echo "[ERROR] No package.json found"
    exit 1
fi

TOTAL_TIME=$(($(date +%s) - START_TIME))
echo "[INFO] Container ready in \${TOTAL_TIME}s, starting dev server..."

if grep -q '"dev"' package.json; then
    exec env CHOKIDAR_USEPOLLING=true ${devCmd}
else
    echo "[WARN] No 'dev' script found, attempting to start with node"
    exec node index.js
fi
`;
}
