import { db } from '../db';
import { chats, messages } from '../db/schema';
import { eq, desc, or, and, exists, ilike } from 'drizzle-orm';
import { AppError } from '../middleware/errorHandler';
import { randomUUID } from 'crypto';
import { sanitizePromptInput } from '../utils/sanitize';

/**
 * Chat Service - Handles chat and message operations
 * Migrated from src/ipc/handlers/chat_handlers.ts
 */
export class ChatService {
  async listChats(appId: string, userId: string) {
    try {
      const limit = Number(process.env.DEFAULT_LIMIT) || 10;
      return await db
        .select()
        .from(chats)
        .where(and(eq(chats.appId, Number.parseInt(appId)), eq(chats.user_id, userId)))
        .orderBy(desc(chats.createdAt))
        .limit(limit);
    } catch (error: any) {
      throw new AppError(500, `Failed to list chats: ${error.message}`);
    }
  }

  async searchChats(term: string, userId: string) {
    try {
      const limit = Number(process.env.DEFAULT_LIMIT) || 10;
      return await db.query.chats.findMany({
        where: and(
          eq(chats.user_id, userId),
          or(
            ilike(chats.title, `%${term}%`),
            exists(
              db
                .select()
                .from(messages)
                .where(
                  and(
                    eq(messages.chatId, chats.id),
                    eq(chats.user_id, userId),
                    ilike(messages.content, `%${term}%`)
                  )
                )
            )
          )
        ),
        with: {
          messages: {
            where: and(
              eq(messages.chatId, chats.id),
              eq(chats.user_id, userId),
              ilike(messages.content, `%${term}%`)
            ),
          },
        },
      });
    } catch (error: any) {
      throw new AppError(500, `Failed to search chats: ${error.message}`);
    }
  }
  async renameChat(chatId: number, newTitle: string, userId: string) {
    try {
      // First ensure chat exists
      const [existing] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, chatId), eq(chats.user_id, userId)));

      if (!existing) {
        throw new AppError(404, `Chat not found: ${chatId}`);
      }

      // Update title
      const updated = await db
        .update(chats)
        .set({ title: newTitle })
        .where(eq(chats.id, chatId))
        .returning();

      return updated[0];
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to rename chat: ${error.message}`);
    }
  }

  async getChat(chatId: string, userId: string) {
    try {
      const [chat] = await db
        .select()
        .from(chats)
        .where(and(eq(chats.id, Number.parseInt(chatId)), eq(chats.user_id, userId)));

      if (!chat) {
        throw new AppError(404, `Chat not found: ${chatId}`);
      }

      return chat;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to get chat: ${error.message}`);
    }
  }

  async createChat(appId: string, title?: string, userId?: string) {
    try {
      const [chat] = await db
        .insert(chats)
        .values({
          appId: Number.parseInt(appId),
          title: title || "New Chat",
          user_id: userId ? userId : undefined,
          createdAt: new Date(),
        })
        .returning();

      return chat;
    } catch (error: any) {
      throw new AppError(500, `Failed to create chat: ${error.message}`);
    }
  }

  async deleteChat(chatId: string, userId: string) {
    try {
      // Delete associated messages first (cascade)
      await db
        .delete(messages)
        .where(
          and(
            eq(messages.chatId, Number.parseInt(chatId)),
            eq(messages.user_id, userId)
          )
        );

      const result = await db
        .delete(chats)
        .where(and(eq(chats.id, Number.parseInt(chatId)), eq(chats.user_id, userId)))
        .returning();

      if (result.length === 0) {
        throw new AppError(404, `Chat not found: ${chatId}`);
      }

      return { success: true, message: "Chat deleted successfully" };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to delete chat: ${error.message}`);
    }
  }

  async getMessages(chatId: string, userId: string) {
    try {
      const limit = Number(process.env.DEFAULT_LIMIT) || 10;
      return await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.chatId, Number.parseInt(chatId)),
            eq(messages.user_id, userId)
          )
        )
        .orderBy(messages.createdAt)
        .limit(limit);
    } catch (error: any) {
      throw new AppError(500, `Failed to get messages: ${error.message}`);
    }
  }

  async createMessage(data: {
    chatId: string;
    role: "user" | "assistant";
    content: string;
    model?: string;
    user_id?: string;
  }) {
    try {
      const chat = await this.getChat(data.chatId , data.user_id ? data.user_id : "");
      if (!chat) {
      throw new AppError(400, 'Chat not found');
      }
      const [message] = await db.insert(messages).values({
        chatId: Number.parseInt(data.chatId),
        user_id: data.user_id ? data.user_id : undefined,
        role: data.role,
        content: sanitizePromptInput(data.content),
        model: data.model,
        isStreaming: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();

      return message;
    } catch (error: any) {
      throw new AppError(500, `Failed to create message: ${error.message}`);
    }
  }

  async updateMessage(
    messageId: string,
    userId: string,
    updates: Partial<{
      content: string;
      isStreaming: boolean;
      approvalState?: string;
     
    }>
  ) {
    try {
       const sanitizedUpdates = { ...updates };
      if (typeof sanitizedUpdates.content === 'string') {
        sanitizedUpdates.content = sanitizePromptInput(sanitizedUpdates.content);
      }
      const [message] = await db
        .update(messages)
        .set({
          ...sanitizedUpdates as any,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(messages.id, Number.parseInt(messageId)),
            eq(messages.user_id, userId)
          )
        )
        .returning();
      if (!message) {
        throw new AppError(404, `Message not found: ${messageId}`);
      }

      return message;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(500, `Failed to update message: ${error.message}`);
    }
  }

  // Placeholder for streaming - will be implemented with WebSocket
  async *streamChat(data: { chatId: string; message: string }) {
    // This will be implemented with actual LLM integration
    // For now, just yield some placeholder chunks
    const words = data.message.split(" ");
    for (const word of words) {
      yield word + " ";
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
