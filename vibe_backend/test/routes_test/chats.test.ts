/**
 * Chats Routes Test Suite
 * Complete test coverage for all chats.ts endpoints
 */

import request from 'supertest';
import express, { Express, Request, Response, NextFunction } from 'express';
import { ChatService } from '../../src/services/chat_service';
import { AppError } from '../../src/middleware/errorHandler';

// Setup mocks before importing routes
jest.mock('../../src/services/chat_service');
jest.mock('../../src/middleware/auth.middleware', () => ({
  requireAuth: (req: Request, res: Response, next: NextFunction) => {
    // Mock authentication middleware - set user ID on request
    (req as any).user = { id: 'test-user-id' };
    next();
  },
}));

let app: Express;
let mockChatService: any;

describe('Chats Routes Tests', () => {
  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());

    // Setup mock ChatService
    mockChatService = {
      listChats: jest.fn(),
      searchChats: jest.fn(),
      renameChat: jest.fn(),
      getChat: jest.fn(),
      createChat: jest.fn(),
      deleteChat: jest.fn(),
      getMessages: jest.fn(),
      createMessage: jest.fn(),
      updateMessage: jest.fn(),
      streamChat: jest.fn(),
    };

    (ChatService as jest.MockedClass<typeof ChatService>).mockImplementation(() => mockChatService);

    // Import and mount router
    const chatsRouter = (await import('../../src/routes/chats')).default;
    app.use('/api/chats', chatsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/chats - List chats', () => {
    it('should return list of chats for an app', async () => {
      const chats = [
        { id: 1, appId: 1, title: 'Chat 1', createdAt: '2025-01-01T00:00:00Z', initialCommitHash: null },
        { id: 2, appId: 1, title: 'Chat 2', createdAt: '2025-01-02T00:00:00Z', initialCommitHash: null },
      ];

      mockChatService.listChats.mockResolvedValue(chats);

      const response = await request(app)
        .get('/api/chats')
        .query({ appId: '1' })
        .expect(200);

      expect(response.body.data).toEqual(chats);
      expect(mockChatService.listChats).toHaveBeenCalledWith('1', 'test-user-id');
    });

    it('should return 400 when appId is missing', async () => {
      await request(app)
        .get('/api/chats')
        .expect(400);
    });

    it('should return empty array when no chats exist', async () => {
      mockChatService.listChats.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/chats')
        .query({ appId: '1' })
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should handle errors when listing chats', async () => {
      mockChatService.listChats.mockRejectedValue(
        new AppError(500, 'Failed to list chats')
      );

      await request(app)
        .get('/api/chats')
        .query({ appId: '1' })
        .expect(500);
    });
  });

  describe('GET /api/chats/search - Search chats', () => {
    it('should search chats by title', async () => {
      const searchResults = [
        {
          id: 1,
          title: 'Test Chat',
          appId: 1,
          createdAt: '2025-01-01T00:00:00Z',
          initialCommitHash: null,
          messages: [],
        },
      ];

      mockChatService.searchChats.mockResolvedValue(searchResults);

      const response = await request(app)
        .get('/api/chats/search')
        .query({ title: 'Test' })
        .expect(200);

      expect(response.body.data).toEqual(searchResults);
      expect(mockChatService.searchChats).toHaveBeenCalledWith('Test', 'test-user-id');
    });

    it('should return 400 when title is missing', async () => {
      await request(app)
        .get('/api/chats/search')
        .expect(400);
    });

    it('should return 400 when title is empty', async () => {
      await request(app)
        .get('/api/chats/search')
        .query({ title: '   ' })
        .expect(400);
    });

    it('should return empty array when no matches found', async () => {
      mockChatService.searchChats.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/chats/search')
        .query({ title: 'NonExistent' })
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should handle errors during search', async () => {
      mockChatService.searchChats.mockRejectedValue(
        new AppError(500, 'Failed to search chats')
      );

      await request(app)
        .get('/api/chats/search')
        .query({ title: 'test' })
        .expect(500);
    });
  });

  describe('GET /api/chats/:id - Get chat by ID', () => {
    it('should return chat by id', async () => {
      const chat = {
        id: 1,
        appId: 1,
        title: 'Test Chat',
        createdAt: '2025-01-01T00:00:00Z',
        initialCommitHash: null,
      };

      mockChatService.getChat.mockResolvedValue(chat);

      const response = await request(app)
        .get('/api/chats/1')
        .expect(200);

      expect(response.body.data).toEqual(chat);
      expect(mockChatService.getChat).toHaveBeenCalledWith('1', 'test-user-id');
    });

    it('should return 404 when chat not found', async () => {
      mockChatService.getChat.mockRejectedValue(
        new AppError(404, 'Chat not found: 999')
      );

      await request(app)
        .get('/api/chats/999')
        .expect(404);
    });

    it('should handle errors when getting chat', async () => {
      mockChatService.getChat.mockRejectedValue(
        new AppError(500, 'Failed to get chat')
      );

      await request(app)
        .get('/api/chats/1')
        .expect(500);
    });
  });

  describe('POST /api/chats - Create chat', () => {
    it('should create chat with required appId', async () => {
      const newChat = {
        id: 3,
        appId: 1,
        title: 'New Chat',
        createdAt: '2025-01-03T00:00:00Z',
        initialCommitHash: null,
      };

      mockChatService.createChat.mockResolvedValue(newChat);

      const response = await request(app)
        .post('/api/chats')
        .send({ appId: '1' })
        .expect(201);

      expect(response.body.data).toEqual(newChat);
      expect(mockChatService.createChat).toHaveBeenCalledWith('1', undefined, 'test-user-id');
    });

    it('should create chat with custom title', async () => {
      const newChat = {
        id: 3,
        appId: 1,
        title: 'Custom Title',
        createdAt: '2025-01-03T00:00:00Z',
        initialCommitHash: null,
      };

      mockChatService.createChat.mockResolvedValue(newChat);

      const response = await request(app)
        .post('/api/chats')
        .send({ appId: '1', title: 'Custom Title' })
        .expect(201);

      expect(response.body.data).toEqual(newChat);
      expect(mockChatService.createChat).toHaveBeenCalledWith('1', 'Custom Title', 'test-user-id');
    });

    it('should return 400 when appId is missing', async () => {
      await request(app)
        .post('/api/chats')
        .send({ title: 'Chat' })
        .expect(400);
    });

    it('should handle errors when creating chat', async () => {
      mockChatService.createChat.mockRejectedValue(
        new AppError(500, 'Failed to create chat')
      );

      await request(app)
        .post('/api/chats')
        .send({ appId: '1' })
        .expect(500);
    });
  });

  describe('PUT /api/chats/:chatId/rename - Rename chat', () => {
    it('should rename chat', async () => {
      const renamedChat = {
        id: 1,
        appId: 1,
        title: 'Renamed Chat',
        createdAt: '2025-01-01T00:00:00Z',
        initialCommitHash: null,
      };

      mockChatService.renameChat.mockResolvedValue(renamedChat);

      const response = await request(app)
        .put('/api/chats/1/rename')
        .send({ title: 'Renamed Chat' })
        .expect(200);

      expect(response.body.data).toEqual(renamedChat);
      expect(mockChatService.renameChat).toHaveBeenCalledWith(1, 'Renamed Chat', 'test-user-id');
    });

    it('should return 400 when title is empty', async () => {
      await request(app)
        .put('/api/chats/1/rename')
        .send({ title: '   ' })
        .expect(400);
    });

    it('should return 400 when title is missing', async () => {
      await request(app)
        .put('/api/chats/1/rename')
        .send({})
        .expect(400);
    });

    it('should return 404 when chat not found', async () => {
      mockChatService.renameChat.mockRejectedValue(
        new AppError(404, 'Chat not found: 999')
      );

      await request(app)
        .put('/api/chats/999/rename')
        .send({ title: 'New Title' })
        .expect(404);
    });

    it('should handle errors when renaming chat', async () => {
      mockChatService.renameChat.mockRejectedValue(
        new AppError(500, 'Failed to rename chat')
      );

      await request(app)
        .put('/api/chats/1/rename')
        .send({ title: 'New Title' })
        .expect(500);
    });
  });

  describe('DELETE /api/chats/:id - Delete chat', () => {
    it('should delete chat', async () => {
      mockChatService.deleteChat.mockResolvedValue({
        success: true,
        message: 'Chat deleted successfully',
      });

      const response = await request(app)
        .delete('/api/chats/1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockChatService.deleteChat).toHaveBeenCalledWith('1', 'test-user-id');
    });

    it('should return 404 when chat not found', async () => {
      mockChatService.deleteChat.mockRejectedValue(
        new AppError(404, 'Chat not found: 999')
      );

      await request(app)
        .delete('/api/chats/999')
        .expect(404);
    });

    it('should handle errors when deleting chat', async () => {
      mockChatService.deleteChat.mockRejectedValue(
        new AppError(500, 'Failed to delete chat')
      );

      await request(app)
        .delete('/api/chats/1')
        .expect(500);
    });
  });

  describe('GET /api/chats/:id/messages - Get messages', () => {
    it('should return messages for a chat', async () => {
      const messages = [
        {
          id: 1,
          chatId: 1,
          role: 'user',
          content: 'Hello',
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
          model: null,
          isStreaming: false,
          approvalState: null,
          sourceCommitHash: null,
          commitHash: null,
          requestId: null,
        },
        {
          id: 2,
          chatId: 1,
          role: 'assistant',
          content: 'Hi there!',
          createdAt: '2025-01-01T00:01:00Z',
          updatedAt: '2025-01-01T00:01:00Z',
          model: null,
          isStreaming: false,
          approvalState: null,
          sourceCommitHash: null,
          commitHash: null,
          requestId: null,
        },
      ];

      mockChatService.getMessages.mockResolvedValue(messages);

      const response = await request(app)
        .get('/api/chats/1/messages')
        .expect(200);

      expect(response.body.data).toEqual(messages);
      expect(mockChatService.getMessages).toHaveBeenCalledWith('1', 'test-user-id');
    });

    it('should return empty array when no messages exist', async () => {
      mockChatService.getMessages.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/chats/1/messages')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should handle errors when getting messages', async () => {
      mockChatService.getMessages.mockRejectedValue(
        new AppError(500, 'Failed to get messages')
      );

      await request(app)
        .get('/api/chats/1/messages')
        .expect(500);
    });
  });

  describe('POST /api/chats/:id/messages - Create message', () => {
    it('should create message with role and content', async () => {
      const newMessage = {
        id: 3,
        chatId: 1,
        role: 'user',
        content: 'New message',
        createdAt: '2025-01-01T00:02:00Z',
        updatedAt: '2025-01-01T00:02:00Z',
        model: null,
        isStreaming: false,
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      mockChatService.createMessage.mockResolvedValue(newMessage);

      const response = await request(app)
        .post('/api/chats/1/messages')
        .send({ role: 'user', content: 'New message' })
        .expect(201);

      expect(response.body.data).toEqual(newMessage);
      expect(mockChatService.createMessage).toHaveBeenCalledWith({
        chatId: '1',
        role: 'user',
        content: 'New message',
        model: undefined,
        user_id: 'test-user-id',
      });
    });

    it('should create message with optional model', async () => {
      const newMessage = {
        id: 3,
        chatId: 1,
        role: 'assistant',
        content: 'Response',
        model: 'gpt-4',
        createdAt: '2025-01-01T00:02:00Z',
        updatedAt: '2025-01-01T00:02:00Z',
        isStreaming: false,
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      mockChatService.createMessage.mockResolvedValue(newMessage);

      const response = await request(app)
        .post('/api/chats/1/messages')
        .send({ role: 'assistant', content: 'Response', model: 'gpt-4' })
        .expect(201);

      expect(response.body.data).toEqual(newMessage);
      expect(mockChatService.createMessage).toHaveBeenCalledWith({
        chatId: '1',
        role: 'assistant',
        content: 'Response',
        model: 'gpt-4',
        user_id: 'test-user-id',
      });
    });

    it('should return 400 when role is missing', async () => {
      await request(app)
        .post('/api/chats/1/messages')
        .send({ content: 'Hello' })
        .expect(400);
    });

    it('should return 400 when content is missing', async () => {
      await request(app)
        .post('/api/chats/1/messages')
        .send({ role: 'user' })
        .expect(400);
    });

    it('should handle errors when creating message', async () => {
      mockChatService.createMessage.mockRejectedValue(
        new AppError(500, 'Failed to create message')
      );

      await request(app)
        .post('/api/chats/1/messages')
        .send({ role: 'user', content: 'Hello' })
        .expect(500);
    });
  });

  describe('PUT /api/chats/:chatId/messages/:messageId - Update message', () => {
    it('should update message content', async () => {
      const updatedMessage = {
        id: 1,
        chatId: 1,
        role: 'user',
        content: 'Updated content',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:03:00Z',
        model: null,
        isStreaming: false,
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      mockChatService.updateMessage.mockResolvedValue(updatedMessage);

      const response = await request(app)
        .put('/api/chats/1/messages/1')
        .send({ content: 'Updated content' })
        .expect(200);

      expect(response.body.data).toEqual(updatedMessage);
      expect(mockChatService.updateMessage).toHaveBeenCalledWith('1', 'test-user-id', { content: 'Updated content' });
    });

    it('should update message streaming status', async () => {
      const updatedMessage = {
        id: 1,
        chatId: 1,
        role: 'assistant',
        content: 'Response',
        isStreaming: false,
        createdAt: '2025-01-01T00:01:00Z',
        updatedAt: '2025-01-01T00:03:00Z',
        model: null,
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      mockChatService.updateMessage.mockResolvedValue(updatedMessage);

      const response = await request(app)
        .put('/api/chats/1/messages/1')
        .send({ isStreaming: false })
        .expect(200);

      expect(response.body.data).toEqual(updatedMessage);
    });

    it('should update message with approval state', async () => {
      const updatedMessage = {
        id: 1,
        chatId: 1,
        role: 'user',
        content: 'Message',
        approvalState: 'approved',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:03:00Z',
        model: null,
        isStreaming: false,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      mockChatService.updateMessage.mockResolvedValue(updatedMessage);

      const response = await request(app)
        .put('/api/chats/1/messages/1')
        .send({ approvalState: 'approved' })
        .expect(200);

      expect(response.body.data.approvalState).toBe('approved');
    });

    it('should return 404 when message not found', async () => {
      mockChatService.updateMessage.mockRejectedValue(
        new AppError(404, 'Message not found: 999')
      );

      await request(app)
        .put('/api/chats/1/messages/999')
        .send({ content: 'Updated' })
        .expect(404);
    });

    it('should handle errors when updating message', async () => {
      mockChatService.updateMessage.mockRejectedValue(
        new AppError(500, 'Failed to update message')
      );

      await request(app)
        .put('/api/chats/1/messages/1')
        .send({ content: 'Updated' })
        .expect(500);
    });
  });
});
