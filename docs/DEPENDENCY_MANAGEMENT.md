# Dependency Management with `<dyad-add-dependency>`

## Overview
The backend has **full support** for adding dependencies via the `<dyad-add-dependency>` tag in AI responses. This document explains how it works.

## Current Status ✅
**FULLY IMPLEMENTED AND FIXED** - The feature is complete and working in the HTTP SSE implementation (`src/routes/stream.ts`).

### Recent Fix (Commit 9d55252)
Fixed the `needsInstall` logic to properly check `packagesToAdd.length > 0` before falling back to `package.json` content comparison. This ensures dependencies are installed when using the `<dyad-add-dependency>` tag.

### Latest Fix (Dec 8, 2025)
Changed implementation to use `pnpm add <packages>` directly instead of writing `"latest"` to package.json. This:
- Installs the actual latest version from npm registry
- Updates package.json with the correct version number
- Updates pnpm-lock.yaml properly
- Fixes the issue where "latest" wasn't recognized as a valid version

## How It Works

### 1. AI Usage
When the AI needs to add npm packages, it uses this tag:
```xml
<dyad-add-dependency packages="react-router-dom zustand"></dyad-add-dependency>
```

**Rules:**
- Use SPACES between package names (NOT commas)
- Example: `packages="pkg1 pkg2 pkg3"`
- The tag is self-closing or can have closing tag

### 2. Backend Processing Flow

#### Step 1: Parse Tags (Lines 591-609 in `stream.ts`)
```typescript
const dyadAddDependencyRegex = /<dyad-add-dependency packages="([^"]+)"(?:\s*\/)?>(?:<\/dyad-add-dependency>)?/g;
const packagesToAdd: string[] = [];

while ((match = dyadAddDependencyRegex.exec(fullResponse)) !== null) {
  const [, packagesStr] = match;
  const packages = packagesStr.trim().split(/\s+/).filter(p => p.length > 0);
  packagesToAdd.push(...packages);
}
```

#### Step 2: Install Dependencies Directly (Lines 776-890)
```typescript
if (packagesToAdd.length > 0) {
  sendEvent('dependencies:installing', {
    packages: packagesToAdd,
    message: 'Installing packages...'
  });
  
  // If container is running, install packages directly using pnpm add
  if (containerService.isEnabled() && isRunning) {
    const packagesStr = packagesToAdd.join(' ');
    const installResult = await containerService.execInContainer(
      app.id.toString(),
      ['sh', '-c', `cd /app && pnpm add ${packagesStr}`]
    );
  } else {
    // Local mode or container not running - use local package manager
    // Or add to package.json with '*' version for later installation
  }
  
  sendEvent('dependencies:installed', {
    packages: packagesToAdd,
    message: 'Packages installed successfully'
  });
}
```

**Key Changes:**
- Uses `pnpm add <packages>` instead of manually updating package.json
- Installs actual latest version from npm registry
- Automatically updates package.json with resolved version
- Updates lock file properly

#### Step 3: Container Already Handles Installation (Lines 985-1015)
Since dependencies are now installed immediately in Step 2, the container sync logic only needs to handle manual package.json changes:

```typescript
// Check if package.json was manually modified
let needsInstall = false;
for (const change of fileChanges) {
  if (change.path === 'package.json' && change.type === 'write') {
    needsInstall = hasPackageJsonChanged(fullAppPath, change.content || '');
    break;
  }
}

if (needsInstall) {
  // Run pnpm install for manually modified package.json
  await containerService.execInContainer(
    app.id.toString(),
    ['sh', '-c', 'cd /app && pnpm install --no-frozen-lockfile']
  );
}
```

**Note:** `packagesToAdd` dependencies are already installed by `pnpm add` in Step 2.

### 3. Frontend Events
The frontend receives these events during the process:

1. **dependencies:installing** - When starting package installation
   ```json
   {
     "type": "dependencies:installing",
     "data": {
       "chatId": 123,
       "packages": ["react-router-dom", "zustand"],
       "message": "Installing 2 packages..."
     }
   }
   ```

2. **dependencies:installed** - When packages are successfully installed
   ```json
   {
     "type": "dependencies:installed",
     "data": {
       "chatId": 123,
       "packages": ["react-router-dom", "zustand"],
       "message": "Installed 2 packages"
     }
   }
   ```

3. **error** - If installation fails
   ```json
   {
     "type": "error",
     "data": {
       "chatId": 123,
       "error": "Failed to install dependencies: <error message>"
     }
   }
   ```

## Package Manager Detection

The system detects the package manager from lock files using `detectPackageManager()` from `src/utils/app_commands.ts`:

```typescript
export function detectPackageManager(appPath: string): PackageManager {
  if (fs.existsSync(path.join(appPath, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(appPath, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(appPath, 'package-lock.json'))) return 'npm';
  
  // Default from env or pnpm
  return process.env.DEFAULT_PACKAGE_MANAGER as PackageManager || 'pnpm';
}
```

Currently, the containerized implementation uses `pnpm` by default.

## Example AI Response

```markdown
I'll add React Router and Zustand for state management.

<dyad-add-dependency packages="react-router-dom zustand"></dyad-add-dependency>

Now I'll create the router configuration...

<dyad-write path="src/router.tsx">
import { createBrowserRouter } from 'react-router-dom';
// ... router code
</dyad-write>
```

## Error Handling

If dependency installation fails:
- Error is logged with context (chatId, packages, error message)
- Error event is sent to frontend:
  ```json
  {
    "type": "error",
    "data": {
      "chatId": 123,
      "error": "Failed to add dependencies: <error message>"
    }
  }
  ```

## Testing

To test dependency management:

1. **Start a chat** with an app
2. **Ask AI to add a package**: "Add react-router-dom to the project"
3. **Watch the logs** for:
   - "Add-dependency operation parsed"
   - "Adding dependencies to package.json"
   - "package.json updated with new dependencies"
   - "Dependencies changed, running install"
   - "Dependencies installed successfully"
4. **Check package.json** in the app directory
5. **Verify container** has the new package installed

## Implementation Files

| File | Purpose | Status |
|------|---------|--------|
| `src/routes/stream.ts` | HTTP SSE implementation | ✅ Complete |
| `src/websocket/chat_stream.ts` | WebSocket implementation (legacy) | ⚠️ Has TODO (not used) |
| `src/services/prompt_service.ts` | AI instruction generation | ✅ Includes dyad-add-dependency docs |
| `src/utils/app_commands.ts` | Package manager detection | ✅ Complete |
| `src/services/containerization_service.ts` | Container execution | ✅ Supports execInContainer |

## Notes

- **Installation Method**: Uses `pnpm add <packages>` which installs latest versions from npm registry
- **Version Resolution**: Package manager resolves the actual latest version and updates package.json
- **Container Sync**: Volume-mounted files mean package.json updates are immediately visible
- **Hot Reload**: After installation, Vite HMR picks up new packages automatically
- **Lock File**: Properly updated by package manager (no --no-frozen-lockfile needed for new packages)
- **Parallel Operations**: Dependency installation happens before file operations complete

## Future Enhancements

Potential improvements (not currently needed):

1. **Specific Versions**: Support `<dyad-add-dependency packages="react-router-dom@6.20.0">`
2. **Dev Dependencies**: Support `<dyad-add-dependency packages="@types/node" dev="true">`
3. **Version Resolution**: Parse package.json to suggest compatible versions
4. **Dependency Cleanup**: Remove unused dependencies automatically
5. **Lock File Updates**: Better handling of lock file synchronization

## Conclusion

The dependency management feature is **fully functional** and integrated with the containerization system. The old WebSocket implementation has a TODO comment, but it's not used by the current server (which uses HTTP SSE).
