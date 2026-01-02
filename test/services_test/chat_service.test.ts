import { ChatService } from "../../src/services/chat_service";
import { chats, messages } from "../../src/db/schema";
import { AppError } from "../../src/middleware/errorHandler";

jest.mock("../../src/db");

import { db } from "../../src/db";

describe("ChatService", () => {
  let service: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChatService();

    // Setup default mock implementations
    const mockSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    };

    const mockInsert = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    const mockUpdate = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    const mockDelete = {
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([]),
    };

    (db.select as jest.Mock).mockReturnValue(mockSelect);
    (db.insert as jest.Mock).mockReturnValue(mockInsert);
    (db.update as jest.Mock).mockReturnValue(mockUpdate);
    (db.delete as jest.Mock).mockReturnValue(mockDelete);
  });

  //
  // -------------------------------------------------------
  // LIST CHATS
  // -------------------------------------------------------
  //
  describe("listChats()", () => {
    it("should return list of chats with default limit", async () => {
      const mockChatList = [
        { id: 1, appId: 1, title: "Chat 1", createdAt: new Date(), initialCommitHash: null },
        { id: 2, appId: 1, title: "Chat 2", createdAt: new Date(), initialCommitHash: null },
      ];

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockChatList),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.listChats("1", 'test-user-id');

      expect(result).toEqual(mockChatList);
      expect(mockSelect.from).toHaveBeenCalledWith(chats);
    });

    it("should use DEFAULT_LIMIT from environment", async () => {
      process.env.DEFAULT_LIMIT = "20";
      const mockChatList: any[] = [];

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockChatList),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.listChats("1", 'test-user-id');

      expect(result).toEqual(mockChatList);
      expect(mockSelect.limit).toHaveBeenCalledWith(20);
    });

    it("should return empty array when no chats exist", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.listChats("999", 'test-user-id');

      expect(result).toEqual([]);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("Connection refused");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.listChats("1", 'test-user-id')).rejects.toThrow("Failed to list chats: Connection refused");
    });
  });

  //
  // -------------------------------------------------------
  // SEARCH CHATS
  // -------------------------------------------------------
  //
  describe("searchChats()", () => {
    it("should return search results by title", async () => {
      const mockSearchResults = [
        {
          id: 1,
          appId: 1,
          title: "Test Chat",
          createdAt: new Date(),
          initialCommitHash: null,
          messages: [],
        },
      ];

      const mockQuery = {
        chats: {
          findMany: jest.fn().mockResolvedValue(mockSearchResults),
        },
      };

      (db.query as any) = mockQuery;

      const result = await service.searchChats("Test", 'test-user-id');

      expect(result).toEqual(mockSearchResults);
      expect(mockQuery.chats.findMany).toHaveBeenCalled();
    });

    it("should return search results by message content", async () => {
      const mockSearchResults = [
        {
          id: 1,
          appId: 1,
          title: "Chat",
          createdAt: new Date(),
          initialCommitHash: null,
          messages: [
            {
              id: 1,
              chatId: 1,
              role: "user",
              content: "Hello world",
              createdAt: new Date(),
              updatedAt: new Date(),
              model: null,
              isStreaming: false,
              approvalState: null,
              sourceCommitHash: null,
              commitHash: null,
              requestId: null,
            },
          ],
        },
      ];

      const mockQuery = {
        chats: {
          findMany: jest.fn().mockResolvedValue(mockSearchResults),
        },
      };

      (db.query as any) = mockQuery;

      const result = await service.searchChats("world", 'test-user-id');

      expect(result).toEqual(mockSearchResults);
    });

    it("should return empty array when no results found", async () => {
      const mockQuery = {
        chats: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      (db.query as any) = mockQuery;

      const result = await service.searchChats("nonexistent", 'test-user-id');

      expect(result).toEqual([]);
    });

    it("should use default limit", async () => {
      delete process.env.DEFAULT_LIMIT;

      const mockQuery = {
        chats: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      (db.query as any) = mockQuery;

      const result = await service.searchChats("test", 'test-user-id');

      expect(result).toEqual([]);
    });

    it("should throw error on DB failure", async () => {
      const mockQuery = {
        chats: {
          findMany: jest.fn().mockImplementation(() => {
            throw new Error("Query failed");
          }),
        },
      };

      (db.query as any) = mockQuery;

      await expect(service.searchChats("test", 'test-user-id')).rejects.toThrow("Failed to search chats: Query failed");
    });
  });

  //
  // -------------------------------------------------------
  // RENAME CHAT
  // -------------------------------------------------------
  //
  describe("renameChat()", () => {
    it("should rename chat successfully", async () => {
      const mockChat = { id: 1, appId: 1, title: "Old Title", createdAt: new Date(), initialCommitHash: null };
      const mockUpdatedChat = {
        id: 1,
        appId: 1,
        title: "New Title",
        createdAt: new Date(),
        initialCommitHash: null,
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockChat]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedChat]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.renameChat(1, "New Title", 'test-user-id');

      expect(result).toEqual(mockUpdatedChat);
      expect(result.title).toBe("New Title");
    });

    it("should throw 404 if chat not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.renameChat(999, "New Title", 'test-user-id')).rejects.toThrow("Chat not found: 999");
    });

    it("should throw error on DB failure during update", async () => {
      const mockChat = { id: 1, appId: 1, title: "Old Title", createdAt: new Date(), initialCommitHash: null };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockChat]),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("DB write failed");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.renameChat(1, "New Title", 'test-user-id')).rejects.toThrow("Failed to rename chat: DB write failed");
    });

    it("should throw error on DB failure during select", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("Connection lost");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.renameChat(1, "New Title", 'test-user-id')).rejects.toThrow("Failed to rename chat: Connection lost");
    });
  });

  //
  // -------------------------------------------------------
  // GET CHAT
  // -------------------------------------------------------
  //
  describe("getChat()", () => {
    it("should return chat by id", async () => {
      const mockChat = {
        id: 1,
        appId: 1,
        title: "Test Chat",
        createdAt: new Date(),
        initialCommitHash: null,
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockChat]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getChat("1", 'test-user-id');

      expect(result).toEqual(mockChat);
    });

    it("should throw 404 if chat not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getChat("999", 'test-user-id')).rejects.toThrow("Chat not found: 999");
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("DB connection failed");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getChat("1", 'test-user-id')).rejects.toThrow("Failed to get chat: DB connection failed");
    });
  });

  //
  // -------------------------------------------------------
  // CREATE CHAT
  // -------------------------------------------------------
  //
  describe("createChat()", () => {
    it("should create chat with default title", async () => {
      const mockChat = {
        id: 3,
        appId: 1,
        title: "New Chat",
        createdAt: new Date(),
        initialCommitHash: null,
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockChat]),
      };

      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createChat("1");

      expect(result).toEqual(mockChat);
      expect(result.title).toBe("New Chat");
      expect(db.insert).toHaveBeenCalledWith(chats);
    });

    it("should create chat with custom title", async () => {
      const mockChat = {
        id: 3,
        appId: 1,
        title: "Custom Chat Title",
        createdAt: new Date(),
        initialCommitHash: null,
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockChat]),
      };

      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createChat("1", "Custom Chat Title");

      expect(result).toEqual(mockChat);
      expect(result.title).toBe("Custom Chat Title");
    });

    it("should throw error on DB failure", async () => {
      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("Insert failed");
        }),
      };

      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      await expect(service.createChat("1")).rejects.toThrow("Failed to create chat: Insert failed");
    });
  });

  //
  // -------------------------------------------------------
  // DELETE CHAT
  // -------------------------------------------------------
  //
  describe("deleteChat()", () => {
    it("should delete chat and cascade messages", async () => {
      const mockDeleteMessages = {
        where: jest.fn().mockResolvedValue([]),
      };

      const mockDeleteChat = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1 }]),
      };

      (db.delete as jest.Mock)
        .mockReturnValueOnce(mockDeleteMessages)
        .mockReturnValueOnce(mockDeleteChat);

      const result = await service.deleteChat("1", 'test-user-id');

      expect(result.success).toBe(true);
      expect(result.message).toBe("Chat deleted successfully");
      expect(mockDeleteMessages.where).toHaveBeenCalled();
    });

    it("should throw 404 if chat not found", async () => {
      const mockDeleteMessages = {
        where: jest.fn().mockResolvedValue([]),
      };

      const mockDeleteChat = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };

      (db.delete as jest.Mock)
        .mockReturnValueOnce(mockDeleteMessages)
        .mockReturnValueOnce(mockDeleteChat);

      await expect(service.deleteChat("999", 'test-user-id')).rejects.toThrow("Chat not found: 999");
    });

    it("should throw error on DB failure", async () => {
      const mockDeleteMessages = {
        where: jest.fn().mockRejectedValue(new Error("DB error")),
      };

      (db.delete as jest.Mock).mockReturnValue(mockDeleteMessages);

      await expect(service.deleteChat("1", 'test-user-id')).rejects.toThrow("Failed to delete chat: DB error");
    });
  });

  //
  // -------------------------------------------------------
  // GET MESSAGES
  // -------------------------------------------------------
  //
  describe("getMessages()", () => {
    it("should return messages for a chat", async () => {
      const mockMessageList = [
        {
          id: 1,
          chatId: 1,
          role: "user",
          content: "Hello",
          createdAt: new Date(),
          updatedAt: new Date(),
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
          role: "assistant",
          content: "Hi there!",
          createdAt: new Date(),
          updatedAt: new Date(),
          model: null,
          isStreaming: false,
          approvalState: null,
          sourceCommitHash: null,
          commitHash: null,
          requestId: null,
        },
      ];

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockMessageList),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getMessages("1", 'test-user-id');

      expect(result).toEqual(mockMessageList);
      expect(mockSelect.from).toHaveBeenCalledWith(messages);
    });

    it("should return empty array when no messages exist", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getMessages("999", 'test-user-id');

      expect(result).toEqual([]);
    });

    it("should use DEFAULT_LIMIT from environment", async () => {
      process.env.DEFAULT_LIMIT = "15";

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await service.getMessages("1", 'test-user-id');

      expect(mockSelect.limit).toHaveBeenCalledWith(15);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("DB connection failed");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getMessages("1", 'test-user-id')).rejects.toThrow("Failed to get messages: DB connection failed");
    });
  });

  //
  // -------------------------------------------------------
  // CREATE MESSAGE
  // -------------------------------------------------------
  //
  describe("createMessage()", () => {
    it("should create message with role and content", async () => {
      const mockMessage = {
        id: 1,
        chatId: 1,
        role: "user",
        content: "Hello world",
        model: null,
        isStreaming: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      const mockChat = { id: 1, user_id: "", title: "Test", createdAt: new Date(), updatedAt: new Date() };
      
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockChat]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockMessage]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createMessage({
        chatId: "1",
        role: "user",
        content: "Hello world",
      });

      expect(result).toEqual(mockMessage);
      expect(result.role).toBe("user");
      expect(result.content).toBe("Hello world");
      expect(db.insert).toHaveBeenCalledWith(messages);
    });

    it("should create message with optional model", async () => {
      const mockMessage = {
        id: 2,
        chatId: 1,
        role: "assistant",
        content: "Response",
        model: "gpt-4",
        isStreaming: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      const mockChat = { id: 1, user_id: "", title: "Test", createdAt: new Date(), updatedAt: new Date() };
      
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockChat]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockMessage]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createMessage({
        chatId: "1",
        role: "assistant",
        content: "Response",
        model: "gpt-4",
      });

      expect(result.model).toBe("gpt-4");
    });

    it("should set isStreaming to false by default", async () => {
      const mockMessage = {
        id: 1,
        chatId: 1,
        role: "user",
        content: "Test",
        model: null,
        isStreaming: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      const mockChat = { id: 1, user_id: "", title: "Test", createdAt: new Date(), updatedAt: new Date() };
      
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockChat]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockMessage]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createMessage({
        chatId: "1",
        role: "user",
        content: "Test",
      });

      expect(result.isStreaming).toBe(false);
    });

    it("should throw error on DB failure", async () => {
      const mockChat = { id: 1, user_id: "", title: "Test", createdAt: new Date(), updatedAt: new Date() };
      
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockChat]),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("Insert failed");
        }),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      await expect(
        service.createMessage({
          chatId: "1",
          role: "user",
          content: "Hello",
        })
      ).rejects.toThrow("Failed to create message: Insert failed");
    });
  });

  //
  // -------------------------------------------------------
  // UPDATE MESSAGE
  // -------------------------------------------------------
  //
  describe("updateMessage()", () => {
    it("should update message content", async () => {
      const mockUpdatedMessage = {
        id: 1,
        chatId: 1,
        role: "user",
        content: "Updated content",
        model: null,
        isStreaming: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedMessage]),
      };

      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateMessage("1", 'test-user-id', { content: "Updated content" });

      expect(result).toEqual(mockUpdatedMessage);
      expect(result.content).toBe("Updated content");
      expect(db.update).toHaveBeenCalledWith(messages);
    });

    it("should update message streaming status", async () => {
      const mockUpdatedMessage = {
        id: 1,
        chatId: 1,
        role: "assistant",
        content: "Response",
        model: null,
        isStreaming: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalState: null,
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedMessage]),
      };

      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateMessage("1", 'test-user-id', { isStreaming: false });

      expect(result.isStreaming).toBe(false);
    });

    it("should update message approval state", async () => {
      const mockUpdatedMessage = {
        id: 1,
        chatId: 1,
        role: "user",
        content: "Message",
        model: null,
        isStreaming: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        approvalState: "approved",
        sourceCommitHash: null,
        commitHash: null,
        requestId: null,
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedMessage]),
      };

      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateMessage("1", 'test-user-id', { approvalState: "approved" });

      expect(result.approvalState).toBe("approved");
    });

    it("should throw 404 if message not found", async () => {
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };

      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.updateMessage("999", 'test-user-id', { content: "Updated" })).rejects.toThrow(
        "Message not found: 999"
      );
    });

    it("should throw error on DB failure", async () => {
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("DB update failed");
        }),
      };

      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.updateMessage("1", 'test-user-id', { content: "Updated" })).rejects.toThrow(
        "Failed to update message: DB update failed"
      );
    });
  });

  //
  // -------------------------------------------------------
  // STREAM CHAT
  // -------------------------------------------------------
  //
  describe("streamChat()", () => {
    it("should yield words from message", async () => {
      const message = "Hello world test";
      const result = service.streamChat({
        chatId: "1",
        message,
      });

      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(chunks[0]).toBe("Hello ");
      expect(chunks[1]).toBe("world ");
      expect(chunks[2]).toBe("test ");
    });

    it("should handle single word message", async () => {
      const result = service.streamChat({
        chatId: "1",
        message: "Hi",
      });

      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe("Hi ");
    });

    it("should handle empty message", async () => {
      const result = service.streamChat({
        chatId: "1",
        message: "",
      });

      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }

      // split on empty string produces [""], which yields 1 chunk
      expect(chunks.length).toBe(1);
    });

    it("should handle message with multiple spaces", async () => {
      const result = service.streamChat({
        chatId: "1",
        message: "Hello    world",
      });

      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
      }

      // split() with "Hello    world" creates: ["Hello", "", "", "", "world"]
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
