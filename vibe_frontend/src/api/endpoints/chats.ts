import { apiClient } from "../client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

export interface Message {
  id: number;
  chatId: number;
  role: "user" | "assistant";
  content: string;
  approvalState: "approved" | "rejected" | null;
  sourceCommitHash: string | null;
  commitHash: string | null;
  requestId: string | null;
  createdAt: Date;
}

export interface Chat {
  id: number;
  appId: number;
  title: string | null;
  initialCommitHash: string | null;
  createdAt: Date;
}

export interface ChatWithMessages extends Chat {
  messages: Message[];
  app?: any;
}

export interface ChatSummary {
  id: number;
  title: string | null;
  createdAt: Date;
  appId: number;
}

export interface ChatSearchResult {
  id: number;
  appId: number;
  title: string | null;
  createdAt: Date;
  matchedMessageContent: string | null;
}

export interface CreateChatParams {
  appId: number;
}

export interface UpdateChatParams {
  title?: string;
}

export const chatsApi = {
  /**
   * List chats (optionally filtered by app)
   * GET /api/chats?appId=:appId
   */
  list: async (appId?: number): Promise<ChatSummary[]> => {
    const params = appId ? { appId } : {};
    return apiClient.get<ChatSummary[]>("/chats", { params });
  },

  /**
   * Get a specific chat (without messages)
   * GET /api/chats/:id
   */
  get: async (chatId: number): Promise<Chat> => {
    return apiClient.get<Chat>(`/chats/${chatId}`);
  },

  /**
   * Get messages for a chat
   * GET /api/chats/:id/messages
   */
  getMessages: async (chatId: number): Promise<Message[]> => {
    return apiClient.get<Message[]>(`/chats/${chatId}/messages`);
  },

  /**
   * Create a new chat
   * POST /api/chats
   */
  create: async (params: CreateChatParams): Promise<Chat> => {
    return apiClient.post<Chat>("/chats", params);
  },

  /**
   * Update a chat
   * PUT /api/chats/:id
   */
  // update: async (chatId: number, params: UpdateChatParams): Promise<Chat> => {
  //   return apiClient.put<Chat>(`/chats/${chatId}`, params);
  // },

  // NOTE: change a route to rename chat
  /**
   * Update a chat (rename)
   * PUT /api/chats/:chatId/rename
   */
  update: async (chatId: number, params: UpdateChatParams): Promise<Chat> => {
    return apiClient.put<Chat>(`/chats/${chatId}/rename`, params);
  },

  /**
   * Delete a chat
   * DELETE /api/chats/:id
   */
  delete: async (chatId: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/chats/${chatId}`);
  },

  /**
   * Delete all messages in a chat
   * DELETE /api/chats/:id/messages
   */
  deleteMessages: async (chatId: number): Promise<{ message: string }> => {
    return apiClient.delete<{ message: string }>(`/chats/${chatId}/messages`);
  },

  /**
   * Search chats by title or message content
   * GET /api/chats/search?appId=:appId&query=:query
   */
  // search: async (appId: number, query: string): Promise<ChatSearchResult[]> => {
  //   return apiClient.get<ChatSearchResult[]>('/chats/search', {
  //     params: { appId, query },
  //   });
  // },

  // NOTE: change a params to search chats
  /**
   * Search chats by title or message content
   * GET /api/chats/search?title=:title
   */
  search: async (title: string): Promise<ChatWithMessages[]> => {
    return apiClient.get<ChatWithMessages[]>("/chats/search", {
      params: { title },
    });
  },

  /**
   * Create a user message
   * POST /api/chats/:id/messages
   */
  createMessage: async (
    chatId: number,
    params: {
      role: "user" | "assistant";
      content: string;
      model?: string;
    },
  ): Promise<Message> => {
    return apiClient.post<Message>(`/chats/${chatId}/messages`, params);
  },

  /**
   * Approve a proposal (code changes)
   * NOTE: Backend repo needs this endpoint - POST /api/chats/:chatId/messages/:messageId/approve
   * NOTE: Proposal parser at client side - Frontend parses and applies files, this just updates DB state
   * Backend should:
   * - Update message.approvalState = 'approved'
   * - Optionally create git commit
   * - Return { success: boolean }
   */
  approveProposal: async (
    chatId: number,
    messageId: number,
  ): Promise<{ success: boolean; extraFiles?: any; extraFilesError?: any }> => {
    return apiClient.post<{
      success: boolean;
      extraFiles?: any;
      extraFilesError?: any;
    }>(`/chats/${chatId}/messages/${messageId}/approve`);
  },

  /**
   * Reject a proposal (code changes)
   * NOTE: Backend repo needs this endpoint - POST /api/chats/:chatId/messages/:messageId/reject
   * NOTE: Proposal parser at client side - Just updates approval state, no files applied
   * Backend should:
   * - Update message.approvalState = 'rejected'
   * - Return { success: boolean }
   */
  rejectProposal: async (
    chatId: number,
    messageId: number,
  ): Promise<{ success: boolean }> => {
    return apiClient.post<{ success: boolean }>(
      `/chats/${chatId}/messages/${messageId}/reject`,
    );
  },

  /**
   * Stream chat response using SSE
   * POST /api/stream/chat
   *
   * Events:
   * - chat:chunk: { chunk: string, fullText: string }
   * - chat:complete: { assistantMessageId: number, fullText: string, updatedFiles: boolean }
   * - chat:error: { error: string }
   */
  streamChat: async (
    params: {
      chatId: number;
      messageId: number;
      prompt: string;
      redo?: boolean;
      attachments?: any[];
      selectedComponent?: any;
      selectedModel?: {
        id: string;
        name: string;
        providerId: string;
      };
      chatMode?: string;
    },
    callbacks: {
      onChunk: (chunk: string, fullText: string) => void;
      onComplete: (data: {
        assistantMessageId: number;
        fullText: string;
        updatedFiles: boolean;
        extraFiles?: any;
        extraFilesError?: any;
      }) => void;
      onError: (error: string) => void;
    },
    signal?: AbortSignal,
    retryCount = 0,
  ): Promise<void> => {
    let token = apiClient.getAccessToken();

    // If no token in memory and this is a retry, try to restore from cookies
    if (!token && retryCount > 0) {
      await apiClient.restoreTokensFromCookiesPublic();
      token = apiClient.getAccessToken();
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/stream/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(params),
      signal,
    });

    // Handle 401 - token expired, retry once after restoring tokens
    if (response.status === 401 && retryCount === 0) {
      await apiClient.restoreTokensFromCookiesPublic();
      // Retry once
      return chatsApi.streamChat(params, callbacks, signal, 1);
    }

    if (!response.ok) {
      const error = await response.text();
      callbacks.onError(error || "Failed to start streaming");
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // Read the stream
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          const eventLines = line.split("\n");
          let event = "message";
          let data = "";

          for (const eventLine of eventLines) {
            if (eventLine.startsWith("event:")) {
              event = eventLine.substring(6).trim();
            } else if (eventLine.startsWith("data:")) {
              data = eventLine.substring(5).trim();
            }
          }

          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (event === "chat:chunk") {
              callbacks.onChunk(parsed.chunk || "", parsed.fullText || "");
            } else if (event === "chat:complete") {
              callbacks.onComplete(parsed);
            } else if (event === "chat:error") {
              callbacks.onError(parsed.error || "Unknown error");
            }
          } catch {
            console.error("Failed to parse SSE data:", data);
          }
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        callbacks.onError(error.message || "Stream failed");
      }
    }
  },
};
