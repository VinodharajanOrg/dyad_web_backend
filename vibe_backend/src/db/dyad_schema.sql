------------------------------------------------------------------------------
-- DYAD APPLICATION DATABASE SCHEMA
-- Enterprise-formatted SQL with named constraints and comments
-- Safe for MasterCard PostgreSQL deployment
------------------------------------------------------------------------------

SET search_path TO public;
------------------------------------------------------------------------------
-- PROMPTS TABLE
------------------------------------------------------------------------------
CREATE TABLE prompts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE prompts IS 'Stores reusable prompt templates used in the Dyad system';
------------------------------------------------------------------------------
-- APPS TABLE
------------------------------------------------------------------------------
CREATE TABLE apps (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    github_org TEXT,
    github_repo TEXT,
    github_branch TEXT,
    supabase_project_id TEXT,
    supabase_parent_project_id TEXT,
    neon_project_id TEXT,
    neon_development_branch_id TEXT,
    neon_preview_branch_id TEXT,
    vercel_project_id TEXT,
    vercel_project_name TEXT,
    vercel_team_id TEXT,
    vercel_deployment_url TEXT,
    install_command TEXT,
    start_command TEXT,
    chat_context JSONB,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE apps IS 'Apps created & managed by users';
------------------------------------------------------------------------------
-- CHATS TABLE
------------------------------------------------------------------------------
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    app_id INTEGER NOT NULL,
    title TEXT,
    initial_commit_hash TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_chats_app_id
        FOREIGN KEY (app_id)
        REFERENCES apps(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE chats IS 'Chat sessions belonging to apps';
------------------------------------------------------------------------------
-- MESSAGES TABLE
------------------------------------------------------------------------------
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    chat_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    is_streaming BOOLEAN NOT NULL DEFAULT FALSE,
    approval_state TEXT CHECK (approval_state IN ('approved', 'rejected')),
    source_commit_hash TEXT,
    commit_hash TEXT,
    request_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_messages_chat_id
        FOREIGN KEY (chat_id)
        REFERENCES chats(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE messages IS 'Message list for each chat';
------------------------------------------------------------------------------
-- VERSIONS TABLE
------------------------------------------------------------------------------
CREATE TABLE versions (
    id SERIAL PRIMARY KEY,
    app_id INTEGER NOT NULL,
    commit_hash TEXT NOT NULL,
    neon_db_timestamp TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_versions_app_id
        FOREIGN KEY (app_id)
        REFERENCES apps(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_versions_app_commit
        UNIQUE (app_id, commit_hash)
);

COMMENT ON TABLE versions IS 'Version tracking for apps';
------------------------------------------------------------------------------
-- TAGS TABLE
------------------------------------------------------------------------------
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    tag_type TEXT NOT NULL,
    path TEXT,
    language TEXT,
    content TEXT,
    start_line INTEGER,
    end_line INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_tags_message_id
        FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE tags IS 'Tags associated with message code blocks';
------------------------------------------------------------------------------
-- FILE CHANGES TABLE
------------------------------------------------------------------------------
CREATE TABLE file_changes (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('write', 'delete')),
    content TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_file_changes_message_id
        FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE file_changes IS 'Tracks file modifications generated by messages';
------------------------------------------------------------------------------
-- IMAGES TABLE
------------------------------------------------------------------------------
CREATE TABLE images (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL,
    url TEXT,
    mime_type TEXT,
    base64 TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_images_message_id
        FOREIGN KEY (message_id)
        REFERENCES messages(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE images IS 'Stores images generated/attached in messages';
------------------------------------------------------------------------------
-- LANGUAGE MODEL PROVIDERS TABLE
------------------------------------------------------------------------------
CREATE TABLE language_model_providers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    api_base_url TEXT NOT NULL,
    env_var_name TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE language_model_providers IS 'Custom or internal AI model providers';

-- Pre-populate built-in AI providers
INSERT INTO language_model_providers (name, api_base_url, env_var_name) VALUES
('OpenAI', 'https://api.openai.com/v1', 'OPENAI_API_KEY'),
('Anthropic', 'https://api.anthropic.com/v1', 'ANTHROPIC_API_KEY'),
('Google', 'https://generativelanguage.googleapis.com/v1', 'GOOGLE_API_KEY');


------------------------------------------------------------------------------
-- LANGUAGE MODELS TABLE
------------------------------------------------------------------------------
CREATE TABLE language_models (
    id SERIAL PRIMARY KEY,
    display_name TEXT NOT NULL,
    api_name TEXT NOT NULL,
    builtin_provider_id TEXT,
    custom_provider_id INTEGER,
    description TEXT,
    max_output_tokens INTEGER,
    context_window INTEGER,
    approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_language_models_custom_provider
        FOREIGN KEY (custom_provider_id)
        REFERENCES language_model_providers(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE language_models IS 'Available AI models from providers';

-- Pre-populate OpenAI models
INSERT INTO language_models (display_name, api_name, builtin_provider_id, custom_provider_id, description, max_output_tokens, context_window) VALUES
('GPT-5.1', 'gpt-5.1', 'openai', 1, 'Most advanced GPT-5 series model', 32768, 256000),
('GPT-5.1 Codex', 'gpt-5.1-codex', 'openai', 1, 'GPT-5 specialized for code generation', 32768, 256000),
('GPT-5.1 Codex Mini', 'gpt-5.1-codex-mini', 'openai', 1, 'Lightweight GPT-5 coding model', 16384, 128000),
('GPT-5.1 Codex Max', 'gpt-5.1-codex-max', 'openai', 1, 'GPT-5 specialized for code generation', 16384, 200000);

-- Pre-populate Anthropic models
INSERT INTO language_models (display_name, api_name, builtin_provider_id, custom_provider_id, description, max_output_tokens, context_window) VALUES
('Claude Opus 4.5', 'claude-opus-4-5', 'anthropic', 2, 'Most powerful Claude model with advanced reasoning', 16384, 300000),
('Claude Sonnet 4.5', 'claude-sonnet-4-5', 'anthropic', 2, 'Balanced performance and speed for Claude 4.5', 16384, 300000),
('Claude 4.5 Haiku', 'claude-haiku-4-5', 'anthropic', 2, 'Fastest Claude 4.5 model for responsive tasks', 8192, 200000);

-- Pre-populate Google models
INSERT INTO language_models (display_name, api_name, builtin_provider_id, custom_provider_id, description, max_output_tokens, context_window) VALUES
('Gemini 3 Pro (Preview)', 'gemini-3-pro-preview', 'google', 3, 'Next-generation Gemini with advanced capabilities', 16384, 2097152),
('Gemini 2.5 Flash', 'gemini-2.5-flash', 'google', 3, 'Fast multimodal model with Gemini 2.5 architecture', 8192, 1048576);

------------------------------------------------------------------------------
-- MCP SERVERS TABLE
------------------------------------------------------------------------------
CREATE TABLE mcp_servers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    transport TEXT NOT NULL,
    command TEXT,
    args JSONB,
    env_json JSONB,
    url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mcp_servers IS 'Model Context Protocol server configurations';


------------------------------------------------------------------------------
-- MCP TOOL CONSENTS TABLE
------------------------------------------------------------------------------
CREATE TABLE mcp_tool_consents (
    id SERIAL PRIMARY KEY,
    server_id INTEGER NOT NULL,
    tool_name TEXT NOT NULL,
    consent TEXT NOT NULL CHECK (consent IN ('ask', 'always', 'denied')),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mcp_tool_consents_server_id
        FOREIGN KEY (server_id)
        REFERENCES mcp_servers(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_mcp_tool_consents_server_tool
        UNIQUE (server_id, tool_name)
);

COMMENT ON TABLE mcp_tool_consents IS 'User consent per MCP server tool';


------------------------------------------------------------------------------
-- DYAD USERS TABLE (renamed to avoid Keycloak conflict)
------------------------------------------------------------------------------
CREATE TABLE dyad_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    username TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_dyad_users_provider_user
        UNIQUE (provider, provider_user_id)
);

COMMENT ON TABLE dyad_users IS 'Application-level users separate from Keycloak users';


------------------------------------------------------------------------------
-- DYAD SESSIONS TABLE
------------------------------------------------------------------------------
CREATE TABLE dyad_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    session_token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dyad_sessions_user_id
        FOREIGN KEY (user_id)
        REFERENCES dyad_users(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE dyad_sessions IS 'User login sessions for Dyad';


------------------------------------------------------------------------------
-- DYAD USER ROLES TABLE
------------------------------------------------------------------------------
CREATE TABLE dyad_user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_dyad_user_roles_user_id
        FOREIGN KEY (user_id)
        REFERENCES dyad_users(id)
        ON DELETE CASCADE
);

COMMENT ON TABLE dyad_user_roles IS 'Role-based access control for Dyad users';
