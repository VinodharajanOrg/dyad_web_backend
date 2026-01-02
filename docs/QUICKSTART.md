# 🚀 Quick Start Guide - PostgreSQL Backend

This is a step-by-step guide to get your Dyad backend running with PostgreSQL.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ installed

## Step 1: Install PostgreSQL (if not installed)

### macOS
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Windows
Download from https://www.postgresql.org/download/windows/

## Step 2: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# In psql, run these commands:
CREATE DATABASE dyad;
CREATE USER dyad_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE dyad TO dyad_user;

# Grant schema permissions (PostgreSQL 15+)
\c dyad
GRANT ALL ON SCHEMA public TO dyad_user;

# Exit psql
\q
```

## Step 3: Install Backend Dependencies

```bash
cd backend
npm install
```

Expected output: All packages installed successfully ✅

## Step 4: Configure Environment

```bash
# Copy example file
cp .env.example .env

# Edit .env file
nano .env  # or use your preferred editor
```

Update these values:
```env
DATABASE_URL=postgresql://dyad_user:your_secure_password@localhost:5432/dyad
PORT=3001
CORS_ORIGIN=http://localhost:5173
DATA_DIR=./data/apps
```

**Important**: Replace `your_secure_password` with the password you set in Step 2!

## Step 5: Initialize Database Schema

```bash
npm run db:push
```

Expected output:
```
✓ Your database is now in sync with your schema
```

✅ Database tables created!

## Step 6: Verify Database

```bash
# Connect to your database
psql -U dyad_user -d dyad

# List tables
\dt

# You should see:
#  apps
#  chats  
#  messages
#  prompts
#  versions
#  tags
#  file_changes
#  images
#  language_model_providers
#  language_models
#  mcp_servers
#  mcp_tool_consents

# Exit
\q
```

## Step 7: Start Backend Server

```bash
npm run dev
```

Expected output:
```
Connecting to PostgreSQL database...
✓ Database connected successfully
🚀 Dyad Backend Server Started
📡 HTTP Server: http://localhost:3001
🔌 WebSocket: ws://localhost:3001
```

✅ Backend is running!

## Step 8: Test API

Open another terminal and test:

```bash
# Test health check (if you added one)
curl http://localhost:3001/api/apps

# Should return: []
```

Or open in browser: http://localhost:3001/api/apps

## 🎉 Success!

Your backend is now running with PostgreSQL!

## Next Steps

### Option A: Start Fresh (New Apps)
Just use the API to create new apps.

### Option B: Migrate from SQLite
If you have existing data:

1. Install better-sqlite3:
   ```bash
   npm install better-sqlite3
   ```

2. Edit migration script:
   ```bash
   nano scripts/migrate-sqlite-to-postgres.ts
   ```
   Update `SQLITE_PATH` to your SQLite database location

3. Run migration:
   ```bash
   npx tsx scripts/migrate-sqlite-to-postgres.ts
   ```

4. Uninstall better-sqlite3:
   ```bash
   npm uninstall better-sqlite3
   ```

## Common Issues

### Issue: "psql: command not found"
**Solution**: PostgreSQL not in PATH. Use full path or add to PATH:
```bash
# macOS
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Issue: "peer authentication failed"
**Solution**: Edit PostgreSQL config:
```bash
# Find config
psql postgres -c "SHOW hba_file"

# Edit it (use your path)
sudo nano /path/to/pg_hba.conf

# Change this line:
# local   all   all   peer
# To:
# local   all   all   md5

# Restart PostgreSQL
brew services restart postgresql@16
```

### Issue: "database 'dyad' does not exist"
**Solution**: Run Step 2 again to create database.

### Issue: "Port 3001 already in use"
**Solution**: Change port in `.env` or kill process:
```bash
lsof -ti:3001 | xargs kill -9
```

### Issue: "Cannot connect to database"
**Solution**: Check if PostgreSQL is running:
```bash
# macOS
brew services list

# Linux
sudo systemctl status postgresql
```

## Useful Commands

```bash
# View database with Drizzle Studio
npm run db:studio

# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate

# Build for production
npm run build

# Run production
npm start
```

## Getting Help

- See [README.md](./README.md) for full documentation
- See [POSTGRESQL_SETUP.md](./POSTGRESQL_SETUP.md) for detailed PostgreSQL setup
- Check the main [MIGRATION_PLAN_SIMPLE.md](../MIGRATION_PLAN_SIMPLE.md) for architecture overview
