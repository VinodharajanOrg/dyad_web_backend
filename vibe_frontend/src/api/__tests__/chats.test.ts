import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatsApi, Chat, ChatWithMessages, Message, ChatSummary, CreateChatParams } from '../endpoints/chats';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getAccessToken: vi.fn(() => 'mock-access-token'),
    restoreTokensFromCookiesPublic: vi.fn(),
  },
}));

describe('chatsApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variable for API_BASE_URL
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockMessage = (overrides?: Partial<Message>): Message => ({
    id: 1,
    chatId: 1,
    role: 'user',
    content: 'Hello',
    approvalState: null,
    sourceCommitHash: null,
    commitHash: null,
    requestId: null,
    createdAt: new Date(),
    ...overrides,
  });

  const createMockChat = (overrides?: Partial<Chat>): Chat => ({
    id: 1,
    appId: 1,
    title: 'Test Chat',
    initialCommitHash: null,
    createdAt: new Date(),
    ...overrides,
  });

  describe('list()', () => {
    it('should fetch all chats', async () => {
      const mockChats: ChatSummary[] = [
        { id: 1, appId: 1, title: 'Chat 1', createdAt: new Date() },
        { id: 2, appId: 1, title: 'Chat 2', createdAt: new Date() },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChats);

      const result = await chatsApi.list();

      expect(mockApiClient.get).toHaveBeenCalledWith('/chats', { params: {} });
      expect(result).toEqual(mockChats);
    });

    it('should fetch chats filtered by appId', async () => {
      const mockChats: ChatSummary[] = [
        { id: 1, appId: 5, title: 'App 5 Chat', createdAt: new Date() },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChats);

      const result = await chatsApi.list(5);

      expect(mockApiClient.get).toHaveBeenCalledWith('/chats', { params: { appId: 5 } });
      expect(result).toEqual(mockChats);
    });

    it('should handle list fetch error', async () => {
      const error = new Error('Failed to fetch chats');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      await expect(chatsApi.list()).rejects.toThrow('Failed to fetch chats');
    });

    it('should return empty list', async () => {
      const mockChats: ChatSummary[] = [];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChats);

      const result = await chatsApi.list();

      expect(result).toHaveLength(0);
    });

    it('should handle list error with specific appId', async () => {
      const error = new Error('App not found');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      await expect(chatsApi.list(999)).rejects.toThrow('App not found');
    });
  });

  describe('get()', () => {
    it('should fetch a chat by id', async () => {
      const mockChat = createMockChat({ id: 10 });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChat);

      const result = await chatsApi.get(10);

      expect(mockApiClient.get).toHaveBeenCalledWith('/chats/10');
      expect(result.id).toBe(10);
    });

    it('should handle get error for non-existent chat', async () => {
      const error = new Error('Chat not found');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      await expect(chatsApi.get(999)).rejects.toThrow('Chat not found');
    });

    it('should fetch chat with all properties', async () => {
      const mockChat = createMockChat({
        id: 5,
        appId: 10,
        title: 'Full Chat',
        initialCommitHash: 'abc123',
        createdAt: new Date('2025-01-01'),
      });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChat);

      const result = await chatsApi.get(5);

      expect(result.appId).toBe(10);
      expect(result.title).toBe('Full Chat');
      expect(result.initialCommitHash).toBe('abc123');
    });

    it('should fetch chat with null initialCommitHash', async () => {
      const mockChat = createMockChat({ id: 5, initialCommitHash: null });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChat);

      const result = await chatsApi.get(5);

      expect(result.initialCommitHash).toBeNull();
    });
  });

  describe('getMessages()', () => {
    it('should fetch messages for a chat', async () => {
      const mockMessages: Message[] = [
        createMockMessage({ id: 1, role: 'user', content: 'Hi' }),
        createMockMessage({ id: 2, role: 'assistant', content: 'Hello!' }),
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockMessages);

      const result = await chatsApi.getMessages(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/chats/1/messages');
      expect(result).toHaveLength(2);
    });

    it('should handle empty messages list', async () => {
      const mockMessages: Message[] = [];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockMessages);

      const result = await chatsApi.getMessages(1);

      expect(result).toHaveLength(0);
    });

    it('should handle fetch error for messages', async () => {
      const error = new Error('Failed to fetch messages');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      await expect(chatsApi.getMessages(1)).rejects.toThrow('Failed to fetch messages');
    });

    it('should fetch messages with approval states', async () => {
      const mockMessages: Message[] = [
        createMockMessage({ id: 1, role: 'user', approvalState: null }),
        createMockMessage({ id: 2, role: 'assistant', approvalState: 'approved' }),
        createMockMessage({ id: 3, role: 'assistant', approvalState: 'rejected' }),
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockMessages);

      const result = await chatsApi.getMessages(1);

      expect(result[1].approvalState).toBe('approved');
      expect(result[2].approvalState).toBe('rejected');
    });
  });

  describe('create()', () => {
    it('should create a new chat', async () => {
      const params: CreateChatParams = { appId: 5 };
      const mockChat = createMockChat({ id: 20, appId: 5 });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockChat);

      const result = await chatsApi.create(params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/chats', params);
      expect(result.appId).toBe(5);
    });

    it('should handle creation failure', async () => {
      const params: CreateChatParams = { appId: 5 };
      const error = new Error('Failed to create chat');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(chatsApi.create(params)).rejects.toThrow('Failed to create chat');
    });

    it('should create chat with null title', async () => {
      const params: CreateChatParams = { appId: 5 };
      const mockChat = createMockChat({ id: 20, appId: 5, title: null });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockChat);

      const result = await chatsApi.create(params);

      expect(result.title).toBeNull();
    });
  });

  describe('delete()', () => {
    it('should delete a chat', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({});

      await chatsApi.delete(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/chats/1');
    });

    it('should handle delete failure', async () => {
      const error = new Error('Failed to delete chat');

      vi.mocked(mockApiClient.delete).mockRejectedValueOnce(error);

      await expect(chatsApi.delete(1)).rejects.toThrow('Failed to delete chat');
    });

    it('should delete chat with different id', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({ message: 'Chat deleted' });

      await chatsApi.delete(42);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/chats/42');
    });
  });

  describe('update()', () => {
    it('should update a chat (rename)', async () => {
      const params = { title: 'New Chat Title' };
      const mockChat = createMockChat({ id: 1, title: 'New Chat Title' });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockChat);

      const result = await chatsApi.update(1, params);

      expect(mockApiClient.put).toHaveBeenCalledWith('/chats/1/rename', params);
      expect(result.title).toBe('New Chat Title');
    });

    it('should handle update failure', async () => {
      const params = { title: 'New Title' };
      const error = new Error('Failed to update chat');

      vi.mocked(mockApiClient.put).mockRejectedValueOnce(error);

      await expect(chatsApi.update(1, params)).rejects.toThrow('Failed to update chat');
    });

    it('should update chat with empty title', async () => {
      const params = { title: '' };
      const mockChat = createMockChat({ id: 1, title: '' });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockChat);

      const result = await chatsApi.update(1, params);

      expect(result.title).toBe('');
    });

    it('should update chat with null title', async () => {
      const params = { title: undefined };
      const mockChat = createMockChat({ id: 1, title: null });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockChat);

      await chatsApi.update(1, params);

      expect(mockApiClient.put).toHaveBeenCalledWith('/chats/1/rename', params);
    });
  });

  describe('search()', () => {
    it('should search chats by title', async () => {
      const mockChats = [
        {
          ...createMockChat({ id: 1, title: 'Test Chat' }),
          messages: [createMockMessage({ content: 'Test message' })],
        },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChats);

      const result = await chatsApi.search('Test');

      expect(mockApiClient.get).toHaveBeenCalledWith('/chats/search', {
        params: { title: 'Test' },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no matches found', async () => {
      const mockChats: ChatWithMessages[] = [];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChats);

      const result = await chatsApi.search('NonExistent');

      expect(result).toHaveLength(0);
    });

    it('should handle search error', async () => {
      const error = new Error('Search failed');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      await expect(chatsApi.search('Test')).rejects.toThrow('Search failed');
    });

    it('should search with partial title match', async () => {
      const mockChats = [
        {
          ...createMockChat({ id: 1, title: 'Test Chat 1' }),
          messages: [],
        },
        {
          ...createMockChat({ id: 2, title: 'Test Chat 2' }),
          messages: [],
        },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChats);

      const result = await chatsApi.search('Test');

      expect(result).toHaveLength(2);
    });

    it('should search and include matched message content', async () => {
      const mockChats = [
        {
          ...createMockChat({ id: 1, title: 'Chat' }),
          messages: [
            createMockMessage({ id: 1, content: 'matching content' }),
            createMockMessage({ id: 2, content: 'other content' }),
          ],
        },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockChats);

      const result = await chatsApi.search('matching');

      expect(result[0].messages).toHaveLength(2);
    });
  });

  describe('deleteMessages()', () => {
    it('should delete all messages in a chat', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({
        message: 'Messages deleted',
      });

      const result = await chatsApi.deleteMessages(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/chats/1/messages');
      expect(result.message).toBe('Messages deleted');
    });

    it('should handle deletion error', async () => {
      const error = new Error('Failed to delete messages');

      vi.mocked(mockApiClient.delete).mockRejectedValueOnce(error);

      await expect(chatsApi.deleteMessages(1)).rejects.toThrow('Failed to delete messages');
    });

    it('should delete messages from different chat', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({
        message: 'Messages deleted',
      });

      await chatsApi.deleteMessages(42);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/chats/42/messages');
    });
  });

  describe('createMessage()', () => {
    it('should create a user message', async () => {
      const params = {
        role: 'user' as const,
        content: 'Hello, what can you do?',
      };

      const mockMessage = createMockMessage({
        id: 5,
        role: 'user',
        content: 'Hello, what can you do?',
      });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockMessage);

      const result = await chatsApi.createMessage(1, params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/chats/1/messages', params);
      expect(result.role).toBe('user');
      expect(result.content).toBe('Hello, what can you do?');
    });

    it('should create assistant message with model', async () => {
      const params = {
        role: 'assistant' as const,
        content: 'I can help with various tasks...',
        model: 'gpt-4',
      };

      const mockMessage = createMockMessage({
        id: 6,
        role: 'assistant',
        content: 'I can help with various tasks...',
      });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockMessage);

      const result = await chatsApi.createMessage(1, params);

      expect(result.role).toBe('assistant');
    });

    it('should handle message creation error', async () => {
      const params = {
        role: 'user' as const,
        content: 'Test message',
      };

      const error = new Error('Failed to create message');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(chatsApi.createMessage(1, params)).rejects.toThrow('Failed to create message');
    });

    it('should create message with empty content', async () => {
      const params = {
        role: 'user' as const,
        content: '',
      };

      const mockMessage = createMockMessage({
        id: 7,
        role: 'user',
        content: '',
      });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockMessage);

      const result = await chatsApi.createMessage(1, params);

      expect(result.content).toBe('');
    });

    it('should create message without model parameter', async () => {
      const params = {
        role: 'assistant' as const,
        content: 'Response without model',
      };

      const mockMessage = createMockMessage({
        id: 8,
        role: 'assistant',
        content: 'Response without model',
      });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockMessage);

      const result = await chatsApi.createMessage(1, params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/chats/1/messages', params);
      expect(result.role).toBe('assistant');
    });
  });

  describe('approveProposal()', () => {
    it('should approve a proposal', async () => {
      const mockResponse = { success: true };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await chatsApi.approveProposal(1, 5);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/chats/1/messages/5/approve'
      );
      expect(result.success).toBe(true);
    });

    it('should approve proposal with extra files', async () => {
      const mockResponse = {
        success: true,
        extraFiles: { file1: 'content' },
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await chatsApi.approveProposal(1, 5);

      expect(result.extraFiles).toEqual({ file1: 'content' });
    });

    it('should approve proposal with extra files error', async () => {
      const mockResponse = {
        success: true,
        extraFilesError: 'Failed to write extra files',
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await chatsApi.approveProposal(1, 5);

      expect(result.extraFilesError).toBe('Failed to write extra files');
    });

    it('should handle approval failure', async () => {
      const error = new Error('Approval failed');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(chatsApi.approveProposal(1, 5)).rejects.toThrow('Approval failed');
    });

    it('should approve with different message and chat ids', async () => {
      const mockResponse = { success: true };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await chatsApi.approveProposal(10, 20);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/chats/10/messages/20/approve'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('rejectProposal()', () => {
    it('should reject a proposal', async () => {
      const mockResponse = { success: true };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await chatsApi.rejectProposal(1, 5);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/chats/1/messages/5/reject'
      );
      expect(result.success).toBe(true);
    });

    it('should handle rejection failure', async () => {
      const error = new Error('Rejection failed');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(chatsApi.rejectProposal(1, 5)).rejects.toThrow('Rejection failed');
    });

    it('should reject with different message and chat ids', async () => {
      const mockResponse = { success: true };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockResponse);

      const result = await chatsApi.rejectProposal(10, 20);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/chats/10/messages/20/reject'
      );
      expect(result.success).toBe(true);
    });
  });

  describe('streamChat()', () => {
    it('should handle streaming chat response', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn().mockResolvedValueOnce({ done: true }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should call onError on stream failure', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const mockResponse = {
        ok: false,
        text: vi.fn().mockResolvedValueOnce('Stream error'),
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith(
        'Stream error'
      );
    });

    it('should parse and handle chat:chunk event', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const sseData = 'event: chat:chunk\ndata: {"chunk":"hello","fullText":"hello"}\n\n';
      const encodedData = new TextEncoder().encode(sseData);

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onChunk).toHaveBeenCalledWith('hello', 'hello');
    });

    it('should parse and handle chat:complete event', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const sseData = 'event: chat:complete\ndata: {"assistantMessageId":5,"fullText":"response text","updatedFiles":true}\n\n';
      const encodedData = new TextEncoder().encode(sseData);

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onComplete).toHaveBeenCalledWith({
        assistantMessageId: 5,
        fullText: 'response text',
        updatedFiles: true,
      });
    });

    it('should parse and handle chat:error event', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const sseData = 'event: chat:error\ndata: {"error":"API error"}\n\n';
      const encodedData = new TextEncoder().encode(sseData);

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith('API error');
    });

    it('should handle multiple SSE events in sequence', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const chunk1Data = 'event: chat:chunk\ndata: {"chunk":"hello","fullText":"hello"}\n\n';
      const chunk2Data = 'event: chat:chunk\ndata: {"chunk":" world","fullText":"hello world"}\n\n';
      const combinedData = chunk1Data + chunk2Data;
      const encodedData = new TextEncoder().encode(combinedData);

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onChunk).toHaveBeenCalledTimes(2);
      expect(callbacks.onChunk).toHaveBeenNthCalledWith(1, 'hello', 'hello');
      expect(callbacks.onChunk).toHaveBeenNthCalledWith(2, ' world', 'hello world');
    });

    it('should handle SSE stream with AbortSignal', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn().mockResolvedValueOnce({ done: true }),
          })),
        },
      };

      const mockAbortSignal = new AbortController().signal;
      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks, mockAbortSignal);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/stream/chat'),
        expect.objectContaining({
          signal: mockAbortSignal,
        })
      );
    });

    it('should handle AbortError gracefully', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' })),
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('should handle non-AbortError stream errors', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const mockError = new Error('Network error');

      const mockReader = {
        read: vi.fn().mockRejectedValueOnce(mockError),
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => mockReader),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onError).toHaveBeenCalledWith('Network error');
    });

    it('should handle invalid JSON in SSE data', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const sseData = 'event: chat:chunk\ndata: {invalid json}\n\n';
      const encodedData = new TextEncoder().encode(sseData);

      // Spy on console.error to verify it's called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      // Should not throw, should log error
      await expect(chatsApi.streamChat(params, callbacks)).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to parse SSE data:',
        '{invalid json}'
      );
      expect(callbacks.onError).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty lines in SSE stream', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const sseData = 'event: chat:chunk\ndata: {"chunk":"test","fullText":"test"}\n\n\n\nevent: chat:chunk\ndata: {"chunk":"2","fullText":"test2"}\n\n';
      const encodedData = new TextEncoder().encode(sseData);

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onChunk).toHaveBeenCalledTimes(2);
    });

    it('should handle response with null body', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const mockResponse = {
        ok: true,
        body: null,
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      // Should handle gracefully
      await expect(async () => {
        await chatsApi.streamChat(params, callbacks);
      }).rejects.toThrow();
    });

    it('should include correct request parameters in fetch call', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn().mockResolvedValueOnce({ done: true }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 5,
        prompt: 'Refactor this code',
        redo: true,
        attachments: [{ name: 'file.ts' }],
        selectedComponent: { id: 'comp1' },
        selectedModel: {
          id: 'model-1',
          name: 'GPT-4',
          providerId: 'openai',
        },
        chatMode: 'code-review',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/stream\/chat$/),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(params),
        })
      );
    });

    it('should handle extra files in complete event', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      const sseData = 'event: chat:complete\ndata: {"assistantMessageId":5,"fullText":"response","updatedFiles":true,"extraFiles":{"test.js":"code"},"extraFilesError":null}\n\n';
      const encodedData = new TextEncoder().encode(sseData);

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      expect(callbacks.onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          extraFiles: { 'test.js': 'code' },
          extraFilesError: null,
        })
      );
    });

    it('should handle unknown SSE event type gracefully', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      // Event type that's not chat:chunk, chat:complete, or chat:error
      const sseData = 'event: chat:unknown\ndata: {"data":"something"}\n\n';
      const encodedData = new TextEncoder().encode(sseData);

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      // Unknown events should not trigger any callbacks
      expect(callbacks.onChunk).not.toHaveBeenCalled();
      expect(callbacks.onComplete).not.toHaveBeenCalled();
      expect(callbacks.onError).not.toHaveBeenCalled();
    });

    it('should handle stream with no data field in event', async () => {
      const callbacks = {
        onChunk: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      // Event with no data field
      const sseData = 'event: chat:chunk\n\n';
      const encodedData = new TextEncoder().encode(sseData);

      let readCalls = 0;
      const mockResponse = {
        ok: true,
        body: {
          getReader: vi.fn(() => ({
            read: vi.fn(async () => {
              readCalls++;
              if (readCalls === 1) {
                return { done: false, value: encodedData };
              }
              return { done: true };
            }),
          })),
        },
      };

      global.fetch = vi.fn().mockResolvedValueOnce(mockResponse);

      const params = {
        chatId: 1,
        messageId: 1,
        prompt: 'Generate code',
      };

      await chatsApi.streamChat(params, callbacks);

      // Should not call any callbacks for events with no data
      expect(callbacks.onChunk).not.toHaveBeenCalled();
    });
  });
});
