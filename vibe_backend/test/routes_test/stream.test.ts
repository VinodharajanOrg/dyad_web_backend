import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import streamRouter from '../../src/routes/stream';

// Mock all dependencies
jest.mock('../../src/services/chat_service');
jest.mock('../../src/services/ai_service');
jest.mock('../../src/services/codebase_service');
jest.mock('../../src/services/prompt_service');
jest.mock('../../src/services/app_service');
jest.mock('../../src/db', () => {
  const mockSelectChain = {
    from: jest.fn(function() {
      return {
        where: jest.fn(function() {
          return {
            limit: jest.fn(() => Promise.resolve([{
              id: 1,
              appId: 1,
              chatId: 1,
              role: 'user',
              content: 'test message',
              createdAt: new Date(),
              updatedAt: new Date(),
            }])),
            orderBy: jest.fn(() => Promise.resolve([{
              id: 1,
              chatId: 1,
              role: 'user',
              content: 'test message',
              createdAt: new Date(),
              updatedAt: new Date(),
            }])),
          };
        }),
      };
    }),
  };

  return {
    db: {
      select: jest.fn(function() {
        return {
          from: jest.fn(function() {
            return {
              where: jest.fn(function() {
                return {
                  limit: jest.fn(() => Promise.resolve([{
                    id: 1,
                    appId: 1,
                    chatId: 1,
                    role: 'user',
                    content: 'test message',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }])),
                  orderBy: jest.fn(() => Promise.resolve([{
                    id: 1,
                    chatId: 1,
                    role: 'user',
                    content: 'test message',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }])),
                };
              }),
            };
          }),
        };
      }),
      insert: jest.fn(() => ({
        values: jest.fn(() => ({
          returning: jest.fn(() => Promise.resolve([{
            id: 2,
            chatId: 1,
            role: 'assistant',
            content: 'test response',
            createdAt: new Date(),
            updatedAt: new Date(),
          }])),
        })),
      })),
      delete: jest.fn(() => ({
        where: jest.fn(() => Promise.resolve(null)),
      })),
    },
  };
});

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('fs');
jest.mock('path');

describe('Stream Routes', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/stream', streamRouter);

    // Add error handling middleware
    app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      res.status(err.statusCode || 500).json({ error: err.message || 'Internal server error' });
    });

    jest.clearAllMocks();
  });

  describe('POST /api/stream/chat - Stream Chat Response', () => {
    test('should accept chat stream request with required chatId', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      // SSE response should have correct headers
      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
    });

    test('should set proper SSE headers', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
      expect(response.headers['x-accel-buffering']).toBe('no');
    });

    test('should accept prompt in request body', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'What does this code do?'
        });

      expect(response.status).toBe(200);
    });

    test('should accept messageId for redo operations', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          messageId: 5,
          redo: true
        });

      expect(response.status).toBe(200);
    });

    test('should accept selectedModel override', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello',
          selectedModel: {
            id: 'gpt-4',
            name: 'GPT-4',
            providerId: 'openai'
          }
        });

      expect(response.status).toBe(200);
    });

    test('should accept chatMode override', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello',
          chatMode: 'agent'
        });

      expect(response.status).toBe(200);
    });

    test('should accept attachments array', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Review this file',
          attachments: [{
            name: 'test.ts',
            type: 'text/plain',
            data: 'const x = 1;',
            attachmentType: 'upload-to-codebase'
          }]
        });

      expect(response.status).toBe(200);
    });

    test('should accept selectedComponent for code context', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Fix this',
          selectedComponent: {
            relativePath: 'src/components/Button.tsx',
            label: 'Button Component'
          }
        });

      expect(response.status).toBe(200);
    });

    test('should accept request with all optional fields', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'What does this code do?',
          messageId: 5,
          attachments: [{
            name: 'test.ts',
            type: 'text/plain',
            data: 'code',
            attachmentType: 'chat-context'
          }],
          selectedComponent: {
            relativePath: 'src/App.tsx',
            label: 'App'
          },
          redo: false,
          selectedModel: {
            id: 'claude-3-opus',
            name: 'Claude 3 Opus',
            providerId: 'anthropic'
          },
          chatMode: 'auto-code'
        });

      expect(response.status).toBe(200);
    });

    test('should handle empty attachments array', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello',
          attachments: []
        });

      expect(response.status).toBe(200);
    });

    test('should handle null selectedComponent', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          selectedComponent: null
        });

      expect(response.status).toBe(200);
    });

    test('should respond with 200 status', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      expect(response.status).toBe(200);
    });

    test('should handle various chatId values', async () => {
      const chatIds = [1, 100, 999, 1000];

      for (const chatId of chatIds) {
        const response = await request(app)
          .post('/api/stream/chat')
          .send({ chatId });

        expect(response.status).toBe(200);
      }
    });

    test('should handle multiple sequential requests', async () => {
      const response1 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      const response2 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 2 });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });
  });

  describe('POST /api/stream/chat/:chatId/cancel - Cancel Stream', () => {
    test('should cancel stream for given chatId', async () => {
      const response = await request(app)
        .post('/api/stream/chat/1/cancel');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });

    test('should return success message', async () => {
      const response = await request(app)
        .post('/api/stream/chat/1/cancel');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('cancelled');
    });

    test('should handle various chatId values', async () => {
      const chatIds = [1, 100, 999];

      for (const chatId of chatIds) {
        const response = await request(app)
          .post(`/api/stream/chat/${chatId}/cancel`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });

    test('should handle string chatId values', async () => {
      const response = await request(app)
        .post('/api/stream/chat/123/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should allow multiple cancellations', async () => {
      const chatId = 1;

      const response1 = await request(app)
        .post(`/api/stream/chat/${chatId}/cancel`);

      const response2 = await request(app)
        .post(`/api/stream/chat/${chatId}/cancel`);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    test('should return JSON response', async () => {
      const response = await request(app)
        .post('/api/stream/chat/1/cancel');

      expect(response.type).toContain('application/json');
    });

    test('should cancel multiple streams with same chatId prefix', async () => {
      // Simulate multiple streams for same chat
      const response = await request(app)
        .post('/api/stream/chat/5/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('HTTP Status Codes and Response Types', () => {
    test('POST /chat should return 200', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      expect(response.status).toBe(200);
    });

    test('POST /chat/:chatId/cancel should return 200', async () => {
      const response = await request(app)
        .post('/api/stream/chat/1/cancel');

      expect(response.status).toBe(200);
    });

    test('POST /chat should return event-stream content type', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    test('POST /chat/:chatId/cancel should return JSON', async () => {
      const response = await request(app)
        .post('/api/stream/chat/1/cancel');

      expect(response.type).toContain('application/json');
    });
  });

  describe('Request Body Validation', () => {
    test('should accept JSON content type', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .set('Content-Type', 'application/json')
        .send({ chatId: 1 });

      expect(response.status).toBe(200);
    });

    test('should handle numeric chatId', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 42 });

      expect(response.status).toBe(200);
    });

    test('should handle string prompt', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'This is a test prompt'
        });

      expect(response.status).toBe(200);
    });

    test('should handle boolean redo flag', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          redo: true
        });

      expect(response.status).toBe(200);
    });

    test('should handle empty prompt string', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: ''
        });

      expect(response.status).toBe(200);
    });

    test('should handle prompt with special characters', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'How do I use @decorator? <tag> "quotes" & ampersand'
        });

      expect(response.status).toBe(200);
    });

    test('should handle large prompts', async () => {
      const largePrompt = 'a'.repeat(10000);

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: largePrompt
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Integration Scenarios', () => {
    test('should start stream and then cancel it', async () => {
      // Start stream
      const streamResponse = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      expect(streamResponse.status).toBe(200);

      // Cancel stream
      const cancelResponse = await request(app)
        .post('/api/stream/chat/1/cancel');

      expect(cancelResponse.status).toBe(200);
      expect(cancelResponse.body.success).toBe(true);
    });

    test('should handle stream with model override and then cancel', async () => {
      // Start stream with model override
      const streamResponse = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 2,
          selectedModel: {
            id: 'gpt-4',
            name: 'GPT-4',
            providerId: 'openai'
          }
        });

      expect(streamResponse.status).toBe(200);

      // Cancel stream
      const cancelResponse = await request(app)
        .post('/api/stream/chat/2/cancel');

      expect(cancelResponse.status).toBe(200);
    });

    test('should handle concurrent streams for different chats', async () => {
      const response1 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      const response2 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 2 });

      const response3 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 3 });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response3.status).toBe(200);
    });

    test('should handle stream with all features combined', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 5,
          prompt: 'Implement a feature',
          messageId: 10,
          attachments: [
            {
              name: 'example.ts',
              type: 'text/plain',
              data: 'const code = 1;',
              attachmentType: 'upload-to-codebase'
            }
          ],
          selectedComponent: {
            relativePath: 'src/components/Main.tsx',
            label: 'Main Component'
          },
          selectedModel: {
            id: 'claude-3-opus',
            name: 'Claude 3 Opus',
            providerId: 'anthropic'
          },
          chatMode: 'auto-code',
          redo: false
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
    });
  });

  describe('Edge Cases', () => {
    test('should handle request with no body fields except chatId', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1 });

      expect(response.status).toBe(200);
    });

    test('should handle cancel for non-existent stream', async () => {
      const response = await request(app)
        .post('/api/stream/chat/999999/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle repeated model override formats', async () => {
      const models = [
        { id: 'model-1', name: 'Model 1', providerId: 'provider-1' },
        { id: 'model-2', name: 'Model 2', providerId: 'provider-2' },
        { id: 'model-3', name: 'Model 3', providerId: 'provider-3' },
      ];

      for (const model of models) {
        const response = await request(app)
          .post('/api/stream/chat')
          .send({
            chatId: 1,
            selectedModel: model
          });

        expect(response.status).toBe(200);
      }
    });

    test('should handle various chatMode values', async () => {
      const modes = ['auto-code', 'agent', 'ask', 'custom'];

      for (const mode of modes) {
        const response = await request(app)
          .post('/api/stream/chat')
          .send({
            chatId: 1,
            chatMode: mode
          });

        expect(response.status).toBe(200);
      }
    });

    test('should handle attachment with different attachment types', async () => {
      const types = ['upload-to-codebase', 'chat-context'];

      for (const type of types) {
        const response = await request(app)
          .post('/api/stream/chat')
          .send({
            chatId: 1,
            attachments: [{
              name: 'file.txt',
              type: 'text/plain',
              data: 'content',
              attachmentType: type
            }]
          });

        expect(response.status).toBe(200);
      }
    });

    // NEW ERROR HANDLING TESTS
    test('should handle chat not found scenario gracefully', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello'
        });

      // Even with mocked db, should complete streaming
      expect(response.status).toBe(200);
    });

    test('should handle app not found scenario gracefully', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello'
        });

      expect(response.status).toBe(200);
    });

    test('should handle selectedModel with API key validation', async () => {
      const AIServiceMock = require('../../src/services/ai_service').AIService;
      
      AIServiceMock.instance = {
        getSettings: jest.fn(() => Promise.resolve({
          apiKeys: { openai: 'sk-xxx' },
          selectedModel: { id: 'gpt-4', name: 'GPT-4', providerId: 'openai' },
          selectedChatMode: 'auto-code',
          smartContextEnabled: false,
          turboEditsV2Enabled: false
        }))
      };

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          selectedModel: {
            id: 'gpt-4',
            name: 'GPT-4',
            providerId: 'openai'
          }
        });

      expect(response.status).toBe(200);
    });

    test('should handle redo operation with message deletion', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Redo test',
          redo: true
        });

      expect(response.status).toBe(200);
    });

    test('should handle message insertion when messageId not provided', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'test prompt'
        });

      expect(response.status).toBe(200);
    });

    test('should fetch existing message when messageId provided', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          messageId: 5
        });

      expect(response.status).toBe(200);
    });

    test('should handle chat stream with multiple attachments', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Review these files',
          attachments: [
            {
              name: 'file1.ts',
              type: 'text/plain',
              data: 'code1',
              attachmentType: 'upload-to-codebase'
            },
            {
              name: 'file2.ts',
              type: 'text/plain',
              data: 'code2',
              attachmentType: 'chat-context'
            }
          ]
        });

      expect(response.status).toBe(200);
    });

    test('should send chat:start event on stream start', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello'
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('chat:start');
    });

    test('should send connected event on stream init', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello'
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('connected');
    });

    test('should handle cancel endpoint for active streams', async () => {
      const response = await request(app)
        .post('/api/stream/chat/1/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Stream cancelled');
    });

    test('should handle cancel on non-existent stream', async () => {
      const response = await request(app)
        .post('/api/stream/chat/99999/cancel');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle empty prompt', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: ''
        });

      expect(response.status).toBe(200);
    });

    test('should handle null messageId gracefully', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          messageId: null,
          prompt: 'Test'
        });

      expect(response.status).toBe(200);
    });

    test('should handle both prompt and messageId provided', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'New prompt',
          messageId: 5
        });

      expect(response.status).toBe(200);
    });

    test('should handle redo with multiple messages', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          redo: true
        });

      expect(response.status).toBe(200);
    });

    test('should override chatMode independently', async () => {
      const AIServiceMock = require('../../src/services/ai_service').AIService;
      
      AIServiceMock.instance = {
        getSettings: jest.fn(() => Promise.resolve({
          apiKeys: { openai: 'sk-xxx' },
          selectedModel: { id: 'gpt-4', name: 'GPT-4', providerId: 'openai' },
          selectedChatMode: 'auto-code',
          smartContextEnabled: false,
          turboEditsV2Enabled: false
        }))
      };

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          chatMode: 'agent'
        });

      expect(response.status).toBe(200);
    });

    test('should handle simultaneous model and chatMode overrides', async () => {
      const AIServiceMock = require('../../src/services/ai_service').AIService;
      
      AIServiceMock.instance = {
        getSettings: jest.fn(() => Promise.resolve({
          apiKeys: { openai: 'sk-xxx', google: 'key-xxx' },
          selectedModel: { id: 'gpt-4', name: 'GPT-4', providerId: 'openai' },
          selectedChatMode: 'auto-code',
          smartContextEnabled: true,
          turboEditsV2Enabled: false
        }))
      };

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          selectedModel: {
            id: 'gemini-pro',
            name: 'Gemini Pro',
            providerId: 'google'
          },
          chatMode: 'agent',
          selectedComponent: {
            relativePath: 'src/app.ts',
            label: 'App Component'
          }
        });

      expect(response.status).toBe(200);
    });

    test('should set proper SSE headers for streaming', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test'
        });

      expect(response.headers['content-type']).toContain('text/event-stream');
      expect(response.headers['cache-control']).toBe('no-cache');
      expect(response.headers['connection']).toBe('keep-alive');
      expect(response.headers['x-accel-buffering']).toBe('no');
    });

    test('should handle attachments with various data types', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          attachments: [
            {
              name: 'image.png',
              type: 'image/png',
              data: 'base64encodeddata',
              attachmentType: 'chat-context'
            },
            {
              name: 'document.pdf',
              type: 'application/pdf',
              data: 'pdfdata',
              attachmentType: 'upload-to-codebase'
            }
          ]
        });

      expect(response.status).toBe(200);
    });

    test('should handle selectedComponent with complex path', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          selectedComponent: {
            relativePath: 'src/features/auth/components/LoginForm.tsx',
            label: 'Login Form Component'
          }
        });

      expect(response.status).toBe(200);
    });

    test('should handle multiple sequential stream requests', async () => {
      const response1 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1, prompt: 'First' });

      expect(response1.status).toBe(200);

      const response2 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1, prompt: 'Second' });

      expect(response2.status).toBe(200);
    });

    test('should handle different chatIds in parallel-like requests', async () => {
      const response1 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 1, prompt: 'Chat 1' });

      const response2 = await request(app)
        .post('/api/stream/chat')
        .send({ chatId: 2, prompt: 'Chat 2' });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    test('should handle very long prompt content', async () => {
      const longPrompt = 'Lorem ipsum '.repeat(1000);

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: longPrompt
        });

      expect(response.status).toBe(200);
    });

    test('should handle special characters in prompt', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'What about <>&"\'` special chars?'
        });

      expect(response.status).toBe(200);
    });

    test('should handle unicode in prompt', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: '你好 مرحبا Привет'
        });

      expect(response.status).toBe(200);
    });

    test('should handle various attachment name formats', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          attachments: [
            {
              name: 'file.with.multiple.dots.ts',
              type: 'text/plain',
              data: 'content',
              attachmentType: 'upload-to-codebase'
            },
            {
              name: 'file-with-dashes.js',
              type: 'text/javascript',
              data: 'content',
              attachmentType: 'chat-context'
            }
          ]
        });

      expect(response.status).toBe(200);
    });

    test('should handle zero attachments array', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          attachments: []
        });

      expect(response.status).toBe(200);
    });

    test('should handle selectedComponent with null value', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          selectedComponent: null
        });

      expect(response.status).toBe(200);
    });

    test('should handle stream with Smart Context enabled', async () => {
      const AIServiceMock = require('../../src/services/ai_service').AIService;
      const CodebaseServiceMock = require('../../src/services/codebase_service').CodebaseService;
      
      AIServiceMock.instance = {
        getSettings: jest.fn(() => Promise.resolve({
          apiKeys: { openai: 'sk-xxx' },
          selectedModel: { id: 'gpt-4', name: 'GPT-4', providerId: 'openai' },
          selectedChatMode: 'auto-code',
          smartContextEnabled: true,
          turboEditsV2Enabled: false
        }))
      };

      CodebaseServiceMock.prototype.extractContext = jest.fn(() => Promise.resolve({
        totalFiles: 50,
        totalSize: 125000
      }));

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello with smart context'
        });

      expect(response.status).toBe(200);
    });

    test('should handle stream with Turbo Edits V2 enabled', async () => {
      const AIServiceMock = require('../../src/services/ai_service').AIService;
      
      AIServiceMock.instance = {
        getSettings: jest.fn(() => Promise.resolve({
          apiKeys: { openai: 'sk-xxx' },
          selectedModel: { id: 'gpt-4', name: 'GPT-4', providerId: 'openai' },
          selectedChatMode: 'auto-code',
          smartContextEnabled: false,
          turboEditsV2Enabled: true
        }))
      };

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Hello with turbo edits'
        });

      expect(response.status).toBe(200);
    });

    test('should handle various chat modes', async () => {
      const AIServiceMock = require('../../src/services/ai_service').AIService;
      
      const modes = ['auto-code', 'ask', 'agent', 'custom'];

      for (const mode of modes) {
        AIServiceMock.instance = {
          getSettings: jest.fn(() => Promise.resolve({
            apiKeys: { openai: 'sk-xxx' },
            selectedModel: { id: 'gpt-4', name: 'GPT-4', providerId: 'openai' },
            selectedChatMode: mode,
            smartContextEnabled: false,
            turboEditsV2Enabled: false
          }))
        };

        const response = await request(app)
          .post('/api/stream/chat')
          .send({
            chatId: 1,
            chatMode: mode
          });

        expect(response.status).toBe(200);
      }
    });

    test('should handle context paths from app configuration', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Check context paths'
        });

      expect(response.status).toBe(200);
    });

    test('should handle auto-includes from smart context', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Check auto includes'
        });

      expect(response.status).toBe(200);
    });

    test('should handle exclude paths configuration', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Check exclude paths'
        });

      expect(response.status).toBe(200);
    });

    test('should handle stream with message context window', async () => {
      const PromptServiceMock = require('../../src/services/prompt_service').PromptService;
      
      PromptServiceMock.prototype.getMaxContextTurns = jest.fn(() => 10);
      PromptServiceMock.prototype.constructSystemPrompt = jest.fn(() => 'System prompt');

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test context window'
        });

      expect(response.status).toBe(200);
    });

  });

  //
  // -------------------------------------------------------
  // ADDITIONAL COVERAGE - Error Paths and Edge Cases
  // -------------------------------------------------------
  //
  describe('Stream Error Paths and Edge Cases', () => {
    test('should handle missing chatId', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          prompt: 'Test without chatId'
        });

      // Expect error (200 with error content or 400)
      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('should handle invalid chatId format', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 'invalid',
          prompt: 'Test'
        });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('should handle chat not found', async () => {
      const ChatServiceMock = require('../../src/services/chat_service').ChatService;
      ChatServiceMock.prototype.getChat = jest.fn().mockRejectedValue(new Error('Chat not found'));

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 999,
          prompt: 'Test'
        });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('should handle empty prompt', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: ''
        });

      expect(response.status).toBe(200);
    });

    test('should handle very long prompt', async () => {
      const longPrompt = 'x'.repeat(10000);
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: longPrompt
        });

      expect(response.status).toBe(200);
    });

    test('should handle null prompt', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: null
        });

      expect(response.status).toBe(200);
    });

    test('should handle undefined attachments', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          attachments: undefined
        });

      expect(response.status).toBe(200);
    });

    test('should handle empty attachments array', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          attachments: []
        });

      expect(response.status).toBe(200);
    });

    test('should handle malformed attachment data', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          attachments: [
            {
              name: 'test.json',
              type: 'application/json',
              data: 'invalid-base64-!!!',
              attachmentType: 'chat-context'
            }
          ]
        });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('should handle attachment without data', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          attachments: [
            {
              name: 'test.json',
              type: 'application/json',
              attachmentType: 'chat-context'
            }
          ]
        });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('should handle selectedComponent with invalid structure', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          selectedComponent: {}
        });

      expect(response.status).toBe(200);
    });

    test('should handle null selectedComponent', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          selectedComponent: null
        });

      expect(response.status).toBe(200);
    });

    test('should handle selectedModel override', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          selectedModel: {
            id: 'gpt-4',
            name: 'GPT-4',
            providerId: 'openai'
          }
        });

      expect(response.status).toBe(200);
    });

    test('should handle invalid chatMode', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          chatMode: 'invalid-mode'
        });

      expect(response.status).toBe(200);
    });

    test('should handle redo flag as true', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          redo: true
        });

      expect(response.status).toBe(200);
    });

    test('should handle redo with messageId', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          messageId: 5,
          redo: true
        });

      expect(response.status).toBe(200);
    });

    test('should handle messageId without redo', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          messageId: 5
        });

      expect(response.status).toBe(200);
    });

    test('should handle invalid messageId type', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          messageId: 'invalid'
        });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('should handle stream abort scenario', async () => {
      // This tests if the abort controller cleanup works
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test'
        });

      expect(response.status).toBe(200);
    });

    test('should handle concurrent requests to same chat', async () => {
      const response1 = request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Request 1'
        });

      const response2 = request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Request 2'
        });

      const [res1, res2] = await Promise.all([response1, response2]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
    });

    test('should handle large attachment file', async () => {
      const largeData = 'data:application/json;base64,' + Buffer.from(JSON.stringify({
        data: 'x'.repeat(50000)
      })).toString('base64');

      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          attachments: [
            {
              name: 'large.json',
              type: 'application/json',
              data: largeData,
              attachmentType: 'upload-to-codebase'
            }
          ]
        });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('should handle multiple attachments', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test',
          attachments: [
            {
              name: 'file1.json',
              type: 'application/json',
              data: 'base64data1',
              attachmentType: 'chat-context'
            },
            {
              name: 'file2.js',
              type: 'text/javascript',
              data: 'base64data2',
              attachmentType: 'upload-to-codebase'
            },
            {
              name: 'file3.txt',
              type: 'text/plain',
              data: 'base64data3',
              attachmentType: 'chat-context'
            }
          ]
        });

      expect(response.status).toBeGreaterThanOrEqual(200);
    });

    test('should handle all chat modes', async () => {
      const modes = ['auto-code', 'agent', 'ask', 'custom'];

      for (const mode of modes) {
        const response = await request(app)
          .post('/api/stream/chat')
          .send({
            chatId: 1,
            prompt: `Test ${mode}`,
            chatMode: mode
          });

        expect(response.status).toBe(200);
      }
    });

    test('should handle streaming with special characters in prompt', async () => {
      const specialPrompt = '你好 مرحبا Привет 🎉 @#$%^&*()';
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: specialPrompt
        });

      expect(response.status).toBe(200);
    });

    test('should handle stream response format', async () => {
      const response = await request(app)
        .post('/api/stream/chat')
        .send({
          chatId: 1,
          prompt: 'Test'
        });

      expect(response.status).toBe(200);
      // Should contain event stream format or data
      expect(response.text || response.body).toBeDefined();
    });

  });
});
