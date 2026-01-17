/**
 * PostgreSQL Database Schema for Dyad
 * Converted from SQLite schema in src/db/schema.ts
 */

import { pgTable,uuid, serial, text, timestamp, integer, boolean, jsonb, unique } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const prompts = pgTable('prompts', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const apps = pgTable('apps', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  githubOrg: text('github_org'),
  githubRepo: text('github_repo'),
  githubBranch: text('github_branch'),
  supabaseProjectId: text('supabase_project_id'),
  supabaseParentProjectId: text('supabase_parent_project_id'),
  neonProjectId: text('neon_project_id'),
  neonDevelopmentBranchId: text('neon_development_branch_id'),
  neonPreviewBranchId: text('neon_preview_branch_id'),
  vercelProjectId: text('vercel_project_id'),
  vercelProjectName: text('vercel_project_name'),
  vercelTeamId: text('vercel_team_id'),
  vercelDeploymentUrl: text('vercel_deployment_url'),
  installCommand: text('install_command'),
  startCommand: text('start_command'),
  chatContext: jsonb('chat_context'),
  isFavorite: boolean('is_favorite').notNull().default(false),
});

export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull().default('default'),
  appId: integer('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  title: text('title'),
  initialCommitHash: text('initial_commit_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  user_id: text('user_id').notNull().default('default'), // For future multi-user support
  chatId: integer('chat_id')
    .notNull()
    .references(() => chats.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant'] }).notNull(),
  content: text('content').notNull(),
  model: text('model'),
  isStreaming: boolean('is_streaming').notNull().default(false),
  approvalState: text('approval_state', { enum: ['approved', 'rejected'] }),
  sourceCommitHash: text('source_commit_hash'),
  commitHash: text('commit_hash'),
  requestId: text('request_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const versions = pgTable('versions', {
  id: serial('id').primaryKey(),
  appId: integer('app_id')
    .notNull()
    .references(() => apps.id, { onDelete: 'cascade' }),
  commitHash: text('commit_hash').notNull(),
  neonDbTimestamp: text('neon_db_timestamp'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueAppCommit: unique('unique_app_commit').on(table.appId, table.commitHash),
}));

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  tagType: text('tag_type').notNull(),
  path: text('path'),
  language: text('language'),
  content: text('content'),
  startLine: integer('start_line'),
  endLine: integer('end_line'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const fileChanges = pgTable('file_changes', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  changeType: text('change_type', { enum: ['write', 'delete'] }).notNull(),
  content: text('content'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const images = pgTable('images', {
  id: serial('id').primaryKey(),
  messageId: integer('message_id')
    .notNull()
    .references(() => messages.id, { onDelete: 'cascade' }),
  url: text('url'),
  mimeType: text('mime_type'),
  base64: text('base64'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const languageModelProviders = pgTable('language_model_providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  apiBaseUrl: text('api_base_url').notNull(),
  envVarName: text('env_var_name'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const languageModels = pgTable('language_models', {
  id: serial('id').primaryKey(),
  displayName: text('display_name').notNull(),
  apiName: text('api_name').notNull(),
  builtinProviderId: text('builtin_provider_id'),
  customProviderId: integer('custom_provider_id')
      .references(() => languageModelProviders.id, { onDelete: 'cascade' }),
  description: text('description'),
  maxOutputTokens: integer('max_output_tokens'),
  contextWindow: integer('context_window'),
  approved: boolean('approved').notNull().default(true), 
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const mcpServers = pgTable('mcp_servers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  transport: text('transport').notNull(),
  command: text('command'),
  args: jsonb('args'),
  envJson: jsonb('env_json'),
  url: text('url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const settings = pgTable('settings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().default('default'), // For future multi-user support
  selectedModel: jsonb('selected_model').notNull(),
  apiKeys: jsonb('api_keys').notNull().default('{}'),
  apiEndpoint: text('api_endpoint'), // Custom API endpoint (e.g., Azure, custom OpenAI proxy)
  selectedChatMode: text('selected_chat_mode').notNull().default('auto-code'),
  smartContextEnabled: boolean('smart_context_enabled').notNull().default(false),
  turboEditsV2Enabled: boolean('turbo_edits_v2_enabled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const mcpToolConsents = pgTable('mcp_tool_consents', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id')
    .notNull()
    .references(() => mcpServers.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  consent: text('consent', { enum: ['ask', 'always', 'denied'] }).notNull().default('ask'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  uniqueServerTool: unique('unique_server_tool').on(table.serverId, table.toolName),
}));

// Relations
export const appsRelations = relations(apps, ({ many }) => ({
  chats: many(chats),
  versions: many(versions),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  app: one(apps, {
    fields: [chats.appId],
    references: [apps.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  tags: many(tags),
  fileChanges: many(fileChanges),
  images: many(images),
}));

export const versionsRelations = relations(versions, ({ one }) => ({
  app: one(apps, {
    fields: [versions.appId],
    references: [apps.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one }) => ({
  message: one(messages, {
    fields: [tags.messageId],
    references: [messages.id],
  }),
}));

export const fileChangesRelations = relations(fileChanges, ({ one }) => ({
  message: one(messages, {
    fields: [fileChanges.messageId],
    references: [messages.id],
  }),
}));

export const imagesRelations = relations(images, ({ one }) => ({
  message: one(messages, {
    fields: [images.messageId],
    references: [messages.id],
  }),
}));

export const languageModelsRelations = relations(languageModels, ({ one }) => ({
  customProvider: one(languageModelProviders, {
    fields: [languageModels.customProviderId],
    references: [languageModelProviders.id],
  }),
}));

export const mcpToolConsentsRelations = relations(mcpToolConsents, ({ one }) => ({
  server: one(mcpServers, {
    fields: [mcpToolConsents.serverId],
    references: [mcpServers.id],
  }),
}));

//user table from login system (not managed by drizzle)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  providerUserId: text('provider_user_id').notNull(),
  provider: text('provider').notNull(),
  username: text('username').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => {
  return {
    uniqueProviderUser: unique('unique_provider_user').on(table.provider, table.providerUserId),
  };
});

//create session table for login system
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  sessionToken: text('session_token').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

//user Role table
export const userRoles = pgTable('user_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

