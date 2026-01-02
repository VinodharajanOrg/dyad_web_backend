# Dependency Management Testing Guide

## Quick Test

To verify that `<dyad-add-dependency>` is working correctly:

### 1. Manual Test via API

```bash
# Start the backend server
npm run dev

# In another terminal, test the tag parsing
curl -X POST http://localhost:3000/api/stream/chat \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": 1,
    "prompt": "Add react-router-dom to the project"
  }'
```

### 2. Check Logs

Look for these log entries:

```
[INFO] Add-dependency operation parsed
  service: stream
  chatId: 1
  operation: 1
  packages: ["react-router-dom"]

[INFO] Adding dependencies to package.json
  service: stream
  chatId: 1
  packages: ["react-router-dom"]

[INFO] package.json updated with new dependencies
  service: stream
  chatId: 1
  totalDependencies: XX

[INFO] Dependencies changed, running install
  service: stream
  chatId: 1
  appId: "1"

[INFO] Dependencies installed successfully
  service: stream
  chatId: 1
  appId: "1"
```

### 3. Verify package.json

```bash
# Check that package.json was updated
cat apps/your-app/package.json | grep react-router-dom
# Should show: "react-router-dom": "latest"
```

### 4. Verify Installation in Container

```bash
# Check if package was installed in container
docker exec dyad-app-1 ls /app/node_modules | grep react-router-dom
# Should show the directory
```

## Test Cases

### Test Case 1: Single Package
**Input:**
```xml
<dyad-add-dependency packages="zustand"></dyad-add-dependency>
```

**Expected:**
- ✅ `zustand` added to `package.json` with version "latest"
- ✅ `pnpm install` runs in container
- ✅ Package available in `node_modules`

### Test Case 2: Multiple Packages
**Input:**
```xml
<dyad-add-dependency packages="react-router-dom axios zustand"></dyad-add-dependency>
```

**Expected:**
- ✅ All 3 packages added to `package.json`
- ✅ Single `pnpm install` runs (not 3 separate installs)
- ✅ All packages available in `node_modules`

### Test Case 3: Package with Special Characters
**Input:**
```xml
<dyad-add-dependency packages="@tanstack/react-query"></dyad-add-dependency>
```

**Expected:**
- ✅ `@tanstack/react-query` added correctly
- ✅ Scoped package name handled properly

### Test Case 4: Self-Closing Tag
**Input:**
```xml
<dyad-add-dependency packages="lodash" />
```

**Expected:**
- ✅ Works the same as with closing tag
- ✅ Regex handles both formats

### Test Case 5: Combined with File Operations
**Input:**
```xml
<dyad-add-dependency packages="react-router-dom"></dyad-add-dependency>

<dyad-write path="src/router.tsx">
import { createBrowserRouter } from 'react-router-dom';
export const router = createBrowserRouter([]);
</dyad-write>
```

**Expected:**
- ✅ Dependencies installed first
- ✅ File written after installation
- ✅ Import works in the new file

## Regression Tests

### Regression 1: Check `needsInstall` Logic
Verify the fix from commit 9d55252:

```typescript
// In stream.ts line 870
let needsInstall = packagesToAdd.length > 0;  // ✅ This should be true first
```

**Test:** Send `<dyad-add-dependency packages="test">` and verify install runs even if package.json wasn't modified manually.

### Regression 2: Package Manager Detection
```bash
# Test with different lock files
cd apps/your-app

# Test pnpm (default)
touch pnpm-lock.yaml
# Should use: pnpm install

# Test npm
rm pnpm-lock.yaml && touch package-lock.json
# Should use: npm install --legacy-peer-deps

# Test yarn
rm package-lock.json && touch yarn.lock
# Should use: yarn install
```

## Error Cases

### Error Case 1: Invalid Package Name
**Input:**
```xml
<dyad-add-dependency packages="invalid@package@name"></dyad-add-dependency>
```

**Expected:**
- ⚠️ Error logged: "Failed to install dependencies"
- ⚠️ Error event sent to frontend
- ⚠️ Other file operations still complete

### Error Case 2: No package.json
**Input:** Run in directory without package.json

**Expected:**
- ❌ Error: "ENOENT: no such file or directory"
- ❌ Logged appropriately
- ⚠️ Chat continues (doesn't crash)

## Performance Tests

### Performance 1: Multiple Dependencies
Add 10 packages at once:
```xml
<dyad-add-dependency packages="pkg1 pkg2 pkg3 pkg4 pkg5 pkg6 pkg7 pkg8 pkg9 pkg10"></dyad-add-dependency>
```

**Measure:**
- Time to update package.json
- Time for `pnpm install`
- Total time before container ready

### Performance 2: Parallel File Operations
Send response with:
- 1 dependency tag
- 10 file writes
- 2 file renames

**Verify:**
- File operations run in parallel (batch size: 5)
- Dependency installation doesn't block file operations
- Total time < sum of individual operations

## Integration Tests

### Integration 1: Full Chat Flow
1. Start new chat
2. AI responds with dependency + code
3. Container automatically restarts
4. Verify app runs with new dependency

### Integration 2: Multiple Rounds
1. Add dependency A in round 1
2. Add dependency B in round 2
3. Verify both are installed
4. Verify no duplicate installs

## Monitoring

### Logs to Watch
```bash
# Follow logs
tail -f logs/app.log | grep -i "depend\|package\|install"
```

### Events to Monitor
- `dependencies:added` - Confirmation of package.json update
- `container:installing` - Install started
- `container:sync-complete` - Install finished
- `error` - Any failures

## Known Limitations

1. **Version Pinning**: All packages use "latest" version
   - Future: Support `<dyad-add-dependency packages="react@18.2.0">`

2. **Dev Dependencies**: All go to `dependencies`
   - Future: Support `<dyad-add-dependency packages="@types/node" dev="true">`

3. **Lock File**: Uses `--no-frozen-lockfile`
   - May cause version drift
   - Consider committing lock files

4. **Rollback**: No automatic rollback on failure
   - Manual recovery needed if install fails

## Troubleshooting

### Issue: Dependencies Not Installing
**Check:**
1. Is containerization enabled? (`CONTAINERIZATION_ENABLED=true`)
2. Is container running? (`docker ps | grep dyad-app`)
3. Does package.json exist in app directory?
4. Are logs showing "Add-dependency operation parsed"?

### Issue: Install Times Out
**Solution:**
- Increase container timeout
- Check network connectivity
- Use package manager cache

### Issue: Wrong Package Manager
**Solution:**
- Check lock files in app directory
- Set `DEFAULT_PACKAGE_MANAGER` env variable
- Verify `detectPackageManager()` logic

## Success Metrics

✅ **Working correctly if:**
1. Tag parsing shows in logs
2. package.json updated with new packages
3. `pnpm install` runs in container
4. No errors in logs
5. Frontend receives success events
6. App imports work without errors

## Conclusion

The dependency management feature is **fully functional** after the fix in commit 9d55252. This test guide helps verify it continues working correctly.
