# Settings API Documentation

## Overview

The Settings API allows users to configure their AI model preferences, API keys, and chat behavior. Settings are persisted in the database and used by the AI service for all chat operations.

## Endpoints

### Get Current Settings

```http
GET /api/settings
```

Returns the current user settings including selected AI model, chat mode, and masked API keys.

**Response:**
```json
{
  "data": {
    "id": 1,
    "userId": "default",
    "selectedModel": {
      "id": "gpt-4-turbo-preview",
      "name": "GPT-4 Turbo",
      "providerId": "openai"
    },
    "apiKeys": {
      "openai": "sk-test-...1234",
      "anthropic": "sk-ant-a...wxyz"
    },
    "selectedChatMode": "auto-code",
    "smartContextEnabled": false,
    "turboEditsV2Enabled": false
  }
}
```

### Update Settings

```http
PUT /api/settings
```

Update user settings (model, chat mode, features).

**Request Body:**
```json
{
  "selectedModel": {
    "id": "claude-3-5-sonnet-20241022",
    "name": "Claude 3.5 Sonnet",
    "providerId": "anthropic"
  },
  "selectedChatMode": "agent",
  "smartContextEnabled": true,
  "turboEditsV2Enabled": false
}
```

**Chat Modes:**
- `auto-code`: Proactive code generation and editing
- `agent`: Planning with tool use
- `ask`: Explanation-only, no code changes
- `custom`: User-defined instructions

### Update API Key

```http
PUT /api/settings/api-keys/{providerId}
```

Add or update an API key for a specific provider.

**Request Body:**
```json
{
  "apiKey": "sk-..."
}
```

**Supported Providers:**
- `openai`: OpenAI GPT models
- `anthropic`: Anthropic Claude models

### Delete API Key

```http
DELETE /api/settings/api-keys/{providerId}
```

Remove an API key for a specific provider.

### Get Available Models

```http
GET /api/settings/models
```

List all available AI models grouped by provider.

**Response:**
```json
{
  "data": {
    "openai": [
      { "id": "gpt-4-turbo-preview", "name": "GPT-4 Turbo" },
      { "id": "gpt-4", "name": "GPT-4" },
      { "id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo" }
    ],
    "anthropic": [
      { "id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet" },
      { "id": "claude-3-opus-20240229", "name": "Claude 3 Opus" },
      { "id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet" },
      { "id": "claude-3-haiku-20240307", "name": "Claude 3 Haiku" }
    ]
  }
}
```

## Security

- API keys are stored encrypted in the database (implement encryption in production)
- API keys are masked in GET responses (only first 8 and last 4 characters shown)
- Environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY) take precedence over database values

## Usage Examples

### cURL Examples

Get current settings:
```bash
curl http://localhost:3000/api/settings
```

Switch to Claude:
```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "selectedModel": {
      "id": "claude-3-5-sonnet-20241022",
      "name": "Claude 3.5 Sonnet",
      "providerId": "anthropic"
    }
  }'
```

Add OpenAI API key:
```bash
curl -X PUT http://localhost:3000/api/settings/api-keys/openai \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "sk-..."}'
```

Enable agent mode:
```bash
curl -X PUT http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -d '{"selectedChatMode": "agent"}'
```

### JavaScript/TypeScript Example

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:3000/api';

// Get available models
const { data: modelsResponse } = await axios.get(`${API_BASE}/settings/models`);
console.log('Available models:', modelsResponse.data);

// Update to GPT-4
await axios.put(`${API_BASE}/settings`, {
  selectedModel: {
    id: 'gpt-4-turbo-preview',
    name: 'GPT-4 Turbo',
    providerId: 'openai'
  },
  selectedChatMode: 'auto-code',
  smartContextEnabled: true
});

// Add API key
await axios.put(`${API_BASE}/settings/api-keys/openai`, {
  apiKey: process.env.OPENAI_API_KEY
});
```

## Testing

Run the test script:
```bash
cd backend
./test_settings_api.sh
```

This will test all endpoints and show the settings workflow.

## Integration with AI Service

The `AIService` now reads settings from the database:

1. Checks database for user settings
2. Falls back to environment variables if database fails
3. Environment variables (OPENAI_API_KEY, ANTHROPIC_API_KEY) always take precedence for security
4. Uses selected model from settings for all chat operations
5. Applies chat mode, smart context, and Turbo Edits V2 settings

## Next Steps

1. **Add API Key Encryption**: Encrypt API keys before storing in database
2. **Multi-user Support**: Use actual user IDs instead of 'default'
3. **Frontend UI**: Create settings page in React app
4. **Provider Management**: Add more AI providers (Google Vertex, Azure OpenAI, etc.)
5. **Model Validation**: Validate model availability against provider APIs
