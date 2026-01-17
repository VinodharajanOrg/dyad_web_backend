import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mcpServersApi,
  McpServer,
  CreateMcpServerParams,
  UpdateMcpServerParams,
} from '../endpoints/mcp-servers';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('mcpServersApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockMcpServer = (overrides?: Partial<McpServer>): McpServer => ({
    id: 1,
    userId: 1,
    name: 'Test MCP Server',
    transport: 'stdio',
    command: 'node',
    args: ['server.js'],
    envJson: { API_KEY: 'key123' },
    url: null,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('list()', () => {
    it('should fetch all MCP servers', async () => {
      const mockServers: McpServer[] = [
        createMockMcpServer({ id: 1, name: 'Server 1' }),
        createMockMcpServer({ id: 2, name: 'Server 2' }),
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ servers: mockServers });

      const result = await mcpServersApi.list();

      expect(mockApiClient.get).toHaveBeenCalledWith('/mcp-servers');
      expect(result.servers).toHaveLength(2);
    });

    it('should return empty servers list', async () => {
      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ servers: [] });

      const result = await mcpServersApi.list();

      expect(result.servers).toEqual([]);
    });
  });

  describe('get()', () => {
    it('should fetch a MCP server by id', async () => {
      const mockServer = createMockMcpServer({ id: 5 });

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockServer);

      const result = await mcpServersApi.get(5);

      expect(mockApiClient.get).toHaveBeenCalledWith('/mcp-servers/5');
      expect(result.id).toBe(5);
      expect(result.transport).toBe('stdio');
    });
  });

  describe('create()', () => {
    it('should create a new MCP server with stdio transport', async () => {
      const params: CreateMcpServerParams = {
        name: 'New Server',
        transport: 'stdio',
        command: 'python',
        args: ['script.py'],
        envJson: { VAR: 'value' },
        enabled: true,
      };

      const mockServer = createMockMcpServer({ id: 10, ...params });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockServer);

      const result = await mcpServersApi.create(params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/mcp-servers', params);
      expect(result.name).toBe('New Server');
      expect(result.transport).toBe('stdio');
    });

    it('should create a new MCP server with sse transport', async () => {
      const params: CreateMcpServerParams = {
        name: 'SSE Server',
        transport: 'sse',
        url: 'http://localhost:8000',
        enabled: true,
      };

      const mockServer = createMockMcpServer({
        id: 11,
        transport: 'sse',
        url: 'http://localhost:8000',
      });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(mockServer);

      const result = await mcpServersApi.create(params);

      expect(result.transport).toBe('sse');
      expect(result.url).toBe('http://localhost:8000');
    });
  });

  describe('update()', () => {
    it('should update MCP server', async () => {
      const params: UpdateMcpServerParams = {
        name: 'Updated Server',
        enabled: false,
      };

      const mockServer = createMockMcpServer({
        id: 1,
        name: 'Updated Server',
        enabled: false,
      });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockServer);

      const result = await mcpServersApi.update(1, params);

      expect(mockApiClient.put).toHaveBeenCalledWith('/mcp-servers/1', params);
      expect(result.name).toBe('Updated Server');
      expect(result.enabled).toBe(false);
    });

    it('should update server environment variables', async () => {
      const params: UpdateMcpServerParams = {
        envJson: { NEW_VAR: 'new_value' },
      };

      const mockServer = createMockMcpServer({
        id: 1,
        envJson: { NEW_VAR: 'new_value' },
      });

      vi.mocked(mockApiClient.put).mockResolvedValueOnce(mockServer);

      const result = await mcpServersApi.update(1, params);

      expect(result.envJson?.NEW_VAR).toBe('new_value');
    });
  });

  describe('delete()', () => {
    it('should delete a MCP server', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({
        message: 'Server deleted',
      });

      const result = await mcpServersApi.delete(1);

      expect(mockApiClient.delete).toHaveBeenCalledWith('/mcp-servers/1');
      expect(result.message).toBe('Server deleted');
    });
  });

  describe('Integration scenarios', () => {
    it('should create → update → list servers', async () => {
      const createParams: CreateMcpServerParams = {
        name: 'New Server',
        transport: 'stdio',
        command: 'node',
        enabled: true,
      };

      const updateParams: UpdateMcpServerParams = {
        enabled: false,
      };

      const createdServer = createMockMcpServer({ id: 20, ...createParams });
      const updatedServer = createMockMcpServer({
        id: 20,
        ...createParams,
        enabled: false,
      });
      const listResponse = { servers: [updatedServer] };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce(createdServer);
      vi.mocked(mockApiClient.put).mockResolvedValueOnce(updatedServer);
      vi.mocked(mockApiClient.get).mockResolvedValueOnce(listResponse);

      const created = await mcpServersApi.create(createParams);
      expect(created.name).toBe('New Server');

      const updated = await mcpServersApi.update(created.id, updateParams);
      expect(updated.enabled).toBe(false);

      const list = await mcpServersApi.list();
      expect(list.servers).toHaveLength(1);
    });
  });
});
