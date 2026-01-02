# App Command Management

This directory contains the centralized app command utilities that are shared across all execution modes (container and local).

## Overview

The `app_commands.ts` module provides a single source of truth for:
- Package manager detection (pnpm, npm, yarn)
- Install commands
- Dev server commands
- Container startup scripts

## Why Centralized?

Previously, container handlers and local runner had duplicate logic for building app commands. This caused:
- Code duplication
- Inconsistent behavior between modes
- Difficult maintenance (changes needed in multiple places)

## Usage

### For Local Execution

```typescript
import { getAppStartupCommand, detectPackageManager } from '../utils/app_commands';

const command = getAppStartupCommand(appPath, port);
const pm = detectPackageManager(appPath);
```

### For Container Execution

```typescript
import { getContainerStartupScript } from '../../utils/app_commands';

const script = getContainerStartupScript(appPath, port);
```

## Package Manager Detection

The utility automatically detects the package manager by checking for lock files:

- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `package-lock.json` or none → npm (default)

## Commands Generated

### NPM
- Install: `npm install --legacy-peer-deps`
- Dev: `npm run dev -- --host 0.0.0.0 --port {port}`

### PNPM
- Install: `pnpm install`
- Dev: `pnpm run dev --host 0.0.0.0 --port {port}`

### Yarn
- Install: `yarn install`
- Dev: `yarn dev --host 0.0.0.0 --port {port}`

## Container-Specific Features

Container startup scripts include additional setup:
- File watcher limit increase (524288)
- Corepack setup for pnpm
- Conditional dependency installation
- CHOKIDAR_USEPOLLING for hot-reload

## Modifying Commands

To change how apps are started:
1. Edit `/backend/src/utils/app_commands.ts`
2. Changes automatically apply to both local and container modes
3. No need to update multiple files
