import { apiClient } from "../client";

export interface McpServer {
  id: number;
  userId: number;
  name: string;
  transport: "stdio" | "sse";
  command: string | null;
  args: string[] | null;
  envJson: Record<string, string> | null;
  url: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMcpServerParams {
  name: string;
  transport: "stdio" | "sse";
  command?: string;
  args?: string[];
  envJson?: Record<string, string>;
  url?: string;
  enabled?: boolean;
}

export interface UpdateMcpServerParams {
  name?: string;
  transport?: "stdio" | "sse";
  command?: string;
  args?: string[];
  envJson?: Record<string, string>;
  url?: string;
  enabled?: boolean;
}

export const mcpServersApi = {
  /**
   * List all MCP servers for current user
   * GET /api/mcp-servers
   */
  list: async (): Promise<{ servers: McpServer[] }> => {
    return apiClient.get<{ servers: McpServer[] }>("/mcp-servers");
  },

  /**
   * Get a specific MCP server
   * GET /api/mcp-servers/:id
   */
  get: async (id: number): Promise<McpServer> => {
    return apiClient.get<McpServer>(`/mcp-servers/${id}`);
  },

  /**
   * Create a new MCP server
   * POST /api/mcp-servers
   */
  create: async (params: CreateMcpServerParams): Promise<McpServer> => {
    return apiClient.post<McpServer>("/mcp-servers", params);
  },

  /**
   * Update an MCP server
   * PUT /api/mcp-servers/:id
   */
  update: async (
    id: number,
    params: UpdateMcpServerParams,
  ): Promise<McpServer> => {
    return apiClient.put<McpServer>(`/mcp-servers/${id}`, params);
  },

  /**
   * Delete an MCP server
   * DELETE /api/mcp-servers/:id
   */
  delete: async (id: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/mcp-servers/${id}`);
  },

  /**
   * Toggle MCP server enabled/disabled
   * POST /api/mcp-servers/:id/toggle
   */
  toggle: async (id: number): Promise<McpServer> => {
    return apiClient.post<McpServer>(`/mcp-servers/${id}/toggle`);
  },
};
