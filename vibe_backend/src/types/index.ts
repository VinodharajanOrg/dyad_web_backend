import { Request } from 'express';

// Extend Express Request with custom properties if needed
export interface CustomRequest extends Request {
  userId?: string;
  // Add other custom properties as needed
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data: any;
}

export interface ChatStreamMessage {
  type: 'chat:stream';
  data: {
    chatId: string;
    message: string;
  };
}

export interface AppOutputMessage {
  type: 'app:start' | 'app:stop';
  data: {
    appId: string;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
