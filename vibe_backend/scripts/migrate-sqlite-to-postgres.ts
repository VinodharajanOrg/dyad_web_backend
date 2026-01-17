import Database from 'better-sqlite3';
import { db } from '../src/db';
import { apps, chats, messages, prompts } from '../src/db/schema';

/**
 * Migrate data from SQLite to PostgreSQL
 * 
 * IMPORTANT: This script is a template. You need to adjust field mappings 
 * based on your actual SQLite schema structure.
 * 
 * Usage:
 * 1. Install better-sqlite3 temporarily: npm install better-sqlite3
 * 2. Update SQLITE_PATH below to your SQLite database path
 * 3. Adjust field mappings to match your SQLite schema
 * 4. Run: npx tsx scripts/migrate-sqlite-to-postgres.ts
 * 5. Uninstall better-sqlite3: npm uninstall better-sqlite3
 */

const SQLITE_PATH = '../data/sqlite.db'; // Update this path

async function migrate() {
  console.log('Starting SQLite to PostgreSQL migration...\n');

  try {
    const sqlite = new Database(SQLITE_PATH, { readonly: true });

    // Migrate prompts (if they exist in your SQLite DB)
    console.log('Migrating prompts...');
    try {
      const sqlitePrompts = sqlite.prepare('SELECT * FROM prompts').all() as any[];
      for (const prompt of sqlitePrompts) {
        await db.insert(prompts).values({
          title: prompt.title || prompt.name, // Adjust based on your schema
          description: prompt.description,
          content: prompt.content,
          createdAt: new Date(prompt.created_at ? prompt.created_at * 1000 : Date.now()),
          updatedAt: new Date(prompt.updated_at ? prompt.updated_at * 1000 : Date.now()),
        });
      }
      console.log(`Migrated ${sqlitePrompts.length} prompts\n`);
    } catch (error) {
      console.log('No prompts table found or error migrating prompts\n');
    }

    // Migrate apps
    console.log('Migrating apps...');
    const sqliteApps = sqlite.prepare('SELECT * FROM apps').all() as any[];
    for (const app of sqliteApps) {
      await db.insert(apps).values({
        name: app.name,
        path: app.path,
        createdAt: new Date(app.created_at * 1000),
        updatedAt: new Date(app.updated_at * 1000),
        // Map other fields if they exist in your SQLite schema
        githubOrg: app.github_org,
        githubRepo: app.github_repo,
        githubBranch: app.github_branch,
        supabaseProjectId: app.supabase_project_id,
        neonProjectId: app.neon_project_id,
        vercelProjectId: app.vercel_project_id,
        installCommand: app.install_command,
        startCommand: app.start_command,
        isFavorite: Boolean(app.is_favorite),
        chatContext: app.chat_context ? JSON.parse(app.chat_context) : null,
      });
    }
    console.log(`Migrated ${sqliteApps.length} apps\n`);

    // Migrate chats
    console.log('Migrating chats...');
    const sqliteChats = sqlite.prepare('SELECT * FROM chats').all() as any[];
    for (const chat of sqliteChats) {
      await db.insert(chats).values({
        appId: chat.app_id,
        title: chat.title,
        initialCommitHash: chat.initial_commit_hash,
        createdAt: new Date(chat.created_at * 1000),
      });
    }
    console.log(`Migrated ${sqliteChats.length} chats\n`);

    // Migrate messages
    console.log('Migrating messages...');
    const sqliteMessages = sqlite.prepare('SELECT * FROM messages').all() as any[];
    for (const message of sqliteMessages) {
      await db.insert(messages).values({
        chatId: message.chat_id,
        role: message.role,
        content: message.content,
        model: message.model,
        isStreaming: Boolean(message.is_streaming),
        approvalState: message.approval_state,
        sourceCommitHash: message.source_commit_hash,
        commitHash: message.commit_hash,
        requestId: message.request_id,
        createdAt: new Date(message.created_at * 1000),
        updatedAt: new Date(message.updated_at * 1000),
      });
    }
    console.log(`Migrated ${sqliteMessages.length} messages\n`);

    sqlite.close();
    console.log('Migration completed successfully!');
    console.log('Note: Some tables may not have been migrated if they didn\'t exist in SQLite');
    console.log('Review the PostgreSQL schema vs your SQLite schema for any differences');

  } catch (error) {
    console.error('Migration failed:', error);
    console.error('Make sure to:');
    console.error('1. Update SQLITE_PATH to point to your SQLite database');
    console.error('2. Adjust field mappings to match your actual SQLite schema');
    console.error('3. Install better-sqlite3: npm install better-sqlite3');
    process.exit(1);
  }
}

migrate();
