# PostgreSQL Setup Guide

This backend now uses PostgreSQL instead of SQLite.

## Prerequisites

1. **PostgreSQL installed** (version 14 or higher)
   ```bash
   # macOS
   brew install postgresql@16
   brew services start postgresql@16
   
   # Ubuntu/Debian
   sudo apt install postgresql postgresql-contrib
   sudo systemctl start postgresql
   ```

2. **Create Database**
   ```bash
   # Connect to PostgreSQL
   psql postgres
   
   # Create database and user
   CREATE DATABASE dyad;
   CREATE USER dyad_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE dyad TO dyad_user;
   \q
   ```

## Configuration

1. **Update .env file**
   ```bash
   cd backend
   cp .env.example .env
   ```

2. **Edit .env with your PostgreSQL credentials**
   ```env
   DATABASE_URL=postgresql://dyad_user:your_password@localhost:5432/dyad
   ```

## Database Setup

### Option 1: Push Schema Directly (Quick Start)
```bash
npm run db:push
```
This pushes your Drizzle schema directly to PostgreSQL without creating migration files.

### Option 2: Generate and Run Migrations (Recommended for Production)
```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

### Option 3: Using Drizzle Studio (Visual Database Manager)
```bash
npm run db:studio
```
Opens a web interface at `https://local.drizzle.studio` to view and edit your database.

## Migrating Data from SQLite

If you have existing data in SQLite, create a migration script:

```typescript
// scripts/migrate-sqlite-to-postgres.ts
import Database from 'better-sqlite3';
import { db } from '../src/db';
import { apps, chats, messages } from '../src/db/schema';

async function migrate() {
  const sqlite = new Database('./data/sqlite.db', { readonly: true });
  
  // Migrate apps
  const sqliteApps = sqlite.prepare('SELECT * FROM apps').all() as any[];
  for (const app of sqliteApps) {
    await db.insert(apps).values({
      name: app.name,
      path: app.path,
      createdAt: new Date(app.created_at * 1000),
      updatedAt: new Date(app.updated_at * 1000),
      // ... other fields
    });
  }
  
  console.log('Migration complete!');
}

migrate();
```

## Verify Connection

```bash
npm run dev
```

Check the logs for:
```
Connecting to PostgreSQL database...
🚀 Dyad Backend Server Started
```

## Troubleshooting

### Connection Refused
- Ensure PostgreSQL is running: `brew services list` or `sudo systemctl status postgresql`
- Check port 5432 is not blocked

### Authentication Failed
- Verify credentials in `.env`
- Check user permissions: `psql -U dyad_user -d dyad`

### Schema Not Found
- Run `npm run db:push` to create tables

## Useful Commands

```bash
# View database
psql -U dyad_user -d dyad

# List tables
\dt

# View apps table
SELECT * FROM apps;

# Drop all tables (careful!)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO dyad_user;
```
