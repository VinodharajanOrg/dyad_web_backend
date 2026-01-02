# File Path Debugging Guide

## Issue Report
**Problem**: When typing "keep going" in chat with an existing app, AI-generated file updates are not being applied to the original app directory.

## Investigation Steps

### 1. Verify Database Paths Are Correct

Run this query to check stored paths:
```bash
psql postgresql://localhost:5432/dyad -c "SELECT id, name, path, created_at FROM apps ORDER BY id;"
```

**Current database state** (as of testing):
```
 id |      name       |                                path                                
----+-----------------+--------------------------------------------------------------------
 14 | test1           | /Users/.../backend/apps/test1
 15 | tic-tac-toe     | /Users/.../backend/apps/tic-tac-toe
 19 | calculator      | /Users/.../backend/apps/calculator-test
 20 | calculator-vite | /Users/.../backend/apps/calculator-vite
 21 | appointment-app | /Users/.../backend/apps/appointment-app
```

✅ **Paths are absolute** and point to correct locations.

### 2. Enhanced Logging Added

**File**: `backend/src/routes/stream.ts`

Added detailed logging to track:
- App ID, Name, and Path when loaded from database
- Full file paths when writing each file
- Success/failure of each file operation

**What to look for in logs** when you send "keep going":

```
📂 App Info:
  ID: 20
  Name: calculator-vite
  Path: /Users/.../backend/apps/calculator-vite
  Chat ID: 42

📊 Found 3 file operations (3 writes, 0 renames, 0 deletes)

📝 Executing file operations in: /Users/.../backend/apps/calculator-vite
  ✅ Wrote: src/App.tsx
     Full path: /Users/.../backend/apps/calculator-vite/src/App.tsx
  ✅ Wrote: src/components/Button.tsx
     Full path: /Users/.../backend/apps/calculator-vite/src/components/Button.tsx
```

### 3. Common Causes & Solutions

#### Cause 1: Multiple Apps with Same Name
**Problem**: User created multiple apps (test versions) and is editing the wrong one.

**Check**:
```bash
psql postgresql://localhost:5432/dyad -c "SELECT id, name, path FROM apps WHERE name LIKE '%calculator%';"
```

**Solution**: Delete old test apps:
```bash
psql postgresql://localhost:5432/dyad -c "DELETE FROM apps WHERE id = <old_app_id>;"
```

#### Cause 2: Chat Associated with Wrong App
**Problem**: The chat is linked to app ID 19 (calculator-test) but user is looking at app ID 20 (calculator-vite).

**Check which app a chat belongs to**:
```bash
psql postgresql://localhost:5432/dyad -c "
  SELECT c.id as chat_id, c.title, c.app_id, a.name as app_name, a.path 
  FROM chats c 
  JOIN apps a ON c.app_id = a.id 
  ORDER BY c.id;
"
```

**Solution**: Update chat's app association (or create new chat for correct app):
```bash
psql postgresql://localhost:5432/dyad -c "UPDATE chats SET app_id = 20 WHERE id = <chat_id>;"
```

#### Cause 3: Relative Paths vs Absolute Paths
**Problem**: App was created with relative path `./apps/calculator-vite` instead of absolute path.

**Check**:
```bash
psql postgresql://localhost:5432/dyad -c "SELECT id, name, path FROM apps WHERE path NOT LIKE '/%';"
```

**Solution**: Update to absolute paths:
```bash
psql postgresql://localhost:5432/dyad -c "
  UPDATE apps 
  SET path = '/Users/hardik.hadvani/.../backend/apps/calculator-vite' 
  WHERE id = 20;
"
```

#### Cause 4: Directory Permissions
**Problem**: Backend can't write to the app directory.

**Check**:
```bash
ls -la /Users/hardik.hadvani/.../backend/apps/calculator-vite/
```

**Solution**:
```bash
chmod -R 755 /Users/hardik.hadvani/.../backend/apps/calculator-vite
```

#### Cause 5: AI Generating Wrong Paths in dyad-write Tags
**Problem**: AI is generating `<dyad-write path="./src/App.tsx">` with wrong prefix.

**Check backend logs** for what the AI is generating:
```
📝 STEP 15: Parsing file operations from AI response...
  ✏️  Write #1: ./src/App.tsx
```

If you see `./src/App.tsx` instead of `src/App.tsx`, the AI is adding an extra `./` prefix.

**Solution**: The code handles this with `path.join(app.path, change.path)` which normalizes paths.

#### Cause 6: Frontend Showing Cached Version
**Problem**: Files ARE being written, but browser is showing old cached version.

**Solution**:
1. Hard refresh browser: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
2. Check Docker container has restarted: `docker ps | grep dyad-app`
3. Check file on disk: `cat /path/to/app/src/App.tsx`

### 4. Real-Time Debugging Steps

**Step 1**: Start backend with enhanced logging:
```bash
cd backend
npx tsx watch src/index.ts
```

**Step 2**: In frontend, open chat with calculator-vite app

**Step 3**: Send message "keep going - add a red border to the calculator"

**Step 4**: Watch backend terminal for:
```
📂 App Info:
  ID: 20
  Name: calculator-vite
  Path: /Users/.../backend/apps/calculator-vite  <-- VERIFY THIS IS CORRECT
  Chat ID: 42

📝 Executing file operations in: /Users/.../backend/apps/calculator-vite  <-- SHOULD MATCH ABOVE
  ✅ Wrote: src/App.tsx
     Full path: /Users/.../backend/apps/calculator-vite/src/App.tsx  <-- SHOULD BE ABSOLUTE
```

**Step 5**: Immediately check file was written:
```bash
ls -la /Users/hardik.hadvani/.../backend/apps/calculator-vite/src/App.tsx
cat /Users/hardik.hadvani/.../backend/apps/calculator-vite/src/App.tsx | grep -i "border"
```

**Step 6**: Check Docker container restarted:
```bash
docker ps | grep dyad-app-20
docker logs dyad-app-20 --tail 50
```

### 5. Frontend Chat Selection Verification

The frontend needs to pass the correct `chatId` to `/api/stream/chat`. 

**Check frontend code** (`dyad_frontend_test/src/components/ChatInterface.tsx`):
```tsx
const streamResponse = await fetch('/api/stream/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    chatId: selectedChatId,  // <-- Is this the correct chat ID?
    messageId: userMessage.id,
  }),
```

**Verify correct chat is selected**:
1. Open browser DevTools → Network tab
2. Find the `POST /api/stream/chat` request
3. Check the request payload: `{"chatId": 42, "messageId": 123}`
4. Cross-reference with database: Does chat 42 belong to calculator-vite app?

```bash
psql postgresql://localhost:5432/dyad -c "
  SELECT c.id, c.title, a.name, a.path 
  FROM chats c 
  JOIN apps a ON c.app_id = a.id 
  WHERE c.id = 42;
"
```

### 6. Common User Mistakes

#### Mistake 1: Looking at Wrong Directory
User created app in `backend/apps/calculator-vite` but is checking files in `dyad_frontend_test/calculator-vite`.

**Solution**: Always check the path shown in logs:
```
📂 App Info:
  Path: /Users/.../backend/apps/calculator-vite  <-- CHECK THIS EXACT PATH
```

#### Mistake 2: Multiple Terminal Windows
User has multiple backend instances running, and is looking at logs from the wrong one.

**Solution**: Kill all backend processes and start fresh:
```bash
pkill -f "tsx watch"
cd backend
npx tsx watch src/index.ts
```

#### Mistake 3: Docker Container Showing Old Code
Files are written to disk, but Docker container hasn't picked up changes.

**Check**:
```bash
# See what's inside the container
docker exec dyad-app-20 ls -la /app/src/
docker exec dyad-app-20 cat /app/src/App.tsx
```

**Solution**: Restart Docker manually:
```bash
curl -X POST http://localhost:3001/api/apps/20/stop
curl -X POST http://localhost:3001/api/apps/20/run
```

### 7. Nuclear Option: Clean Slate

If nothing works, create a brand new app and chat:

```bash
# Delete all apps and chats (WARNING: Destructive!)
psql postgresql://localhost:5432/dyad -c "TRUNCATE TABLE messages, chats, apps RESTART IDENTITY CASCADE;"

# Or delete just one app
psql postgresql://localhost:5432/dyad -c "DELETE FROM apps WHERE id = 20;"  # This cascades to chats and messages
```

Then in frontend:
1. Create new app: "calculator-fresh"
2. Create new chat for that app
3. Send prompt: "Create a simple calculator app with React and Vite"
4. After app is created, send: "Add a red border"
5. Watch logs to see files being written

### 8. File Path Verification Checklist

Run this to get a complete picture:

```bash
# 1. Check what apps exist
psql postgresql://localhost:5432/dyad -c "SELECT id, name, path FROM apps;"

# 2. Check which chats belong to which apps
psql postgresql://localhost:5432/dyad -c "
  SELECT c.id as chat_id, c.title, a.id as app_id, a.name, a.path 
  FROM chats c 
  JOIN apps a ON c.app_id = a.id;
"

# 3. Check if app directories actually exist on disk
psql postgresql://localhost:5432/dyad -c "SELECT path FROM apps;" | tail -n +3 | head -n -2 | while read path; do
  if [ -d "$path" ]; then
    echo "✅ EXISTS: $path"
  else
    echo "❌ MISSING: $path"
  fi
done

# 4. Check Docker containers
docker ps -a | grep dyad-app

# 5. Check recent messages to see which chat is active
psql postgresql://localhost:5432/dyad -c "
  SELECT m.id, m.chat_id, m.role, LEFT(m.content, 50) as content_preview, m.created_at
  FROM messages m
  ORDER BY m.created_at DESC
  LIMIT 10;
"
```

### 9. Expected Flow for "Keep Going"

1. User types "keep going" in chat interface
2. Frontend sends: `POST /api/stream/chat { chatId: X, prompt: "keep going" }`
3. Backend loads chat X from database
4. Backend finds chat.appId (e.g., app ID 20)
5. Backend loads app 20 from database
6. **CRITICAL**: `app.path` should be `/Users/.../backend/apps/calculator-vite`
7. AI generates code with `<dyad-write path="src/App.tsx">...</dyad-write>`
8. Backend writes to: `path.join(app.path, "src/App.tsx")`
   - Result: `/Users/.../backend/apps/calculator-vite/src/App.tsx` ✅
9. Docker container restarts
10. App at http://localhost:32100 shows updated code

### 10. Debug Script

Save this as `debug-file-paths.sh`:

```bash
#!/bin/bash

echo "===================="
echo "DYAD FILE PATH DEBUG"
echo "===================="

echo -e "\n1. Apps in database:"
psql postgresql://localhost:5432/dyad -c "SELECT id, name, path FROM apps;"

echo -e "\n2. Chats and their apps:"
psql postgresql://localhost:5432/dyad -c "
  SELECT c.id as chat_id, c.title, a.id as app_id, a.name
  FROM chats c
  JOIN apps a ON c.app_id = a.id
  ORDER BY c.created_at DESC
  LIMIT 10;
"

echo -e "\n3. Recent messages (last 5):"
psql postgresql://localhost:5432/dyad -c "
  SELECT m.id, m.chat_id, m.role, LEFT(m.content, 60) as preview, m.created_at
  FROM messages m
  ORDER BY m.created_at DESC
  LIMIT 5;
"

echo -e "\n4. Running Docker containers:"
docker ps | grep dyad-app || echo "No dyad containers running"

echo -e "\n5. Checking if app directories exist:"
psql postgresql://localhost:5432/dyad -t -c "SELECT path FROM apps;" | while read -r path; do
  path=$(echo "$path" | xargs)  # Trim whitespace
  if [ -n "$path" ] && [ -d "$path" ]; then
    file_count=$(find "$path" -type f | wc -l)
    echo "✅ $path ($file_count files)"
  elif [ -n "$path" ]; then
    echo "❌ MISSING: $path"
  fi
done

echo -e "\n===================="
```

Run it:
```bash
chmod +x debug-file-paths.sh
./debug-file-paths.sh
```

## Summary

The enhanced logging will now show:
- **Exact app path** being used for each chat message
- **Full file paths** for every write operation
- **Success/failure** for each file operation

When you send "keep going", watch the backend terminal for these logs. They will immediately tell you if files are being written to the correct location.

If you see files being written to a different path than expected, the issue is with the chat-app association in the database, not with the file writing logic itself.
