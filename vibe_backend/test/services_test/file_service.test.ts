import { FileService } from "../../src/services/file_service";
import { apps } from "../../src/db/schema";
import { AppError } from "../../src/middleware/errorHandler";
import fs from "fs/promises";
import path from "path";

jest.mock("fs/promises");
jest.mock("../../src/db");
jest.mock("../../src/utils/file_ignore", () => ({
  shouldIgnorePath: jest.fn((name) => name.startsWith(".")),
}));

import { db } from "../../src/db";
import { shouldIgnorePath } from "../../src/utils/file_ignore";

describe("FileService", () => {
  let service: FileService;

  const mockApp = {
    id: 1,
    name: "test-app",
    path: "/home/user/apps/test-app",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FileService();

    // Setup default mock implementations
    const mockSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([mockApp]),
    };

    (db.select as jest.Mock).mockReturnValue(mockSelect);
  });

  //
  // -------------------------------------------------------
  // READ FILE
  // -------------------------------------------------------
  //
  describe("readFile()", () => {
    it("should read file successfully", async () => {
      const fileContent = "console.log('hello');";

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readFile as jest.Mock).mockResolvedValue(fileContent);

      const result = await service.readFile("1", "index.js");

      expect(result).toBe(fileContent);
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockApp.path, "index.js"),
        "utf-8"
      );
    });

    it("should throw 404 if file not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readFile as jest.Mock).mockRejectedValue({ code: "ENOENT" });

      await expect(service.readFile("1", "missing.js")).rejects.toThrow(
        "File not found: missing.js"
      );
    });

    it("should throw 404 if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.readFile("999", "file.js")).rejects.toThrow(
        "App not found: 999"
      );
    });

    it("should prevent path traversal attacks", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readFile as jest.Mock).mockResolvedValue("content");

      await service.readFile("1", "../../../etc/passwd");

      const callArgs = (fs.readFile as jest.Mock).mock.calls[0][0];
      expect(callArgs).not.toContain("..");
    });

    it("should throw error on read failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readFile as jest.Mock).mockRejectedValue(new Error("Permission denied"));

      await expect(service.readFile("1", "file.js")).rejects.toThrow(
        "Failed to read file: Permission denied"
      );
    });
  });

  //
  // -------------------------------------------------------
  // WRITE FILE
  // -------------------------------------------------------
  //
  describe("writeFile()", () => {
    it("should write file successfully", async () => {
      const fileContent = "console.log('hello');";

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.writeFile("1", "index.js", fileContent);

      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockApp.path, "index.js"),
        fileContent,
        "utf-8"
      );
    });

    it("should create parent directories if they don't exist", async () => {
      const fileContent = "content";

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await service.writeFile("1", "src/components/Button.js", fileContent);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname(path.join(mockApp.path, "src/components/Button.js")),
        { recursive: true }
      );
    });

    it("should throw 404 if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.writeFile("999", "file.js", "content")).rejects.toThrow(
        "App not found: 999"
      );
    });

    it("should throw error on write failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error("Disk full"));

      await expect(service.writeFile("1", "file.js", "content")).rejects.toThrow(
        "Failed to write file: Disk full"
      );
    });
  });

  //
  // -------------------------------------------------------
  // DELETE FILE
  // -------------------------------------------------------
  //
  describe("deleteFile()", () => {
    it("should delete file successfully", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await service.deleteFile("1", "index.js");

      expect(fs.unlink).toHaveBeenCalledWith(path.join(mockApp.path, "index.js"));
    });

    it("should throw 404 if file not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.unlink as jest.Mock).mockRejectedValue({ code: "ENOENT" });

      await expect(service.deleteFile("1", "missing.js")).rejects.toThrow(
        "File not found: missing.js"
      );
    });

    it("should throw 404 if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.deleteFile("999", "file.js")).rejects.toThrow(
        "App not found: 999"
      );
    });

    it("should throw error on delete failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.unlink as jest.Mock).mockRejectedValue(new Error("Permission denied"));

      await expect(service.deleteFile("1", "file.js")).rejects.toThrow(
        "Failed to delete file: Permission denied"
      );
    });
  });

  //
  // -------------------------------------------------------
  // LIST FILES
  // -------------------------------------------------------
  //
  describe("listFiles()", () => {
    it("should list files in directory successfully", async () => {
      const mockEntries = [
        { name: "index.js", isDirectory: jest.fn().mockReturnValue(false) },
        { name: "src", isDirectory: jest.fn().mockReturnValue(true) },
      ];

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readdir as jest.Mock).mockResolvedValue(mockEntries);
      (shouldIgnorePath as jest.Mock).mockReturnValue(false);

      const result = await service.listFiles("1", "");

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("index.js");
      expect(result[0].isDirectory).toBe(false);
      expect(result[1].name).toBe("src");
      expect(result[1].isDirectory).toBe(true);
    });

    it("should filter out ignored paths", async () => {
      const mockEntries = [
        { name: "index.js", isDirectory: jest.fn().mockReturnValue(false) },
        { name: ".gitignore", isDirectory: jest.fn().mockReturnValue(false) },
        { name: ".env", isDirectory: jest.fn().mockReturnValue(false) },
        { name: "src", isDirectory: jest.fn().mockReturnValue(true) },
      ];

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readdir as jest.Mock).mockResolvedValue(mockEntries);
      (shouldIgnorePath as jest.Mock).mockImplementation((name) => name.startsWith("."));

      const result = await service.listFiles("1", "");

      expect(result).toHaveLength(2);
      expect(result.every((f) => !f.name.startsWith("."))).toBe(true);
    });

    it("should list files in subdirectory", async () => {
      const mockEntries = [
        { name: "App.js", isDirectory: jest.fn().mockReturnValue(false) },
      ];

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readdir as jest.Mock).mockResolvedValue(mockEntries);
      (shouldIgnorePath as jest.Mock).mockReturnValue(false);

      const result = await service.listFiles("1", "src/components");

      expect(fs.readdir).toHaveBeenCalledWith(
        path.join(mockApp.path, "src/components"),
        { withFileTypes: true }
      );
      expect(result[0].path).toBe(path.join("src/components", "App.js"));
    });

    it("should throw 404 if directory not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readdir as jest.Mock).mockRejectedValue({ code: "ENOENT" });

      await expect(service.listFiles("1", "missing")).rejects.toThrow(
        "Directory not found: missing"
      );
    });

    it("should throw 404 if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.listFiles("999", "")).rejects.toThrow("App not found: 999");
    });

    it("should throw error on list failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.readdir as jest.Mock).mockRejectedValue(new Error("Permission denied"));

      await expect(service.listFiles("1", "")).rejects.toThrow(
        "Failed to list files: Permission denied"
      );
    });
  });

  //
  // -------------------------------------------------------
  // CREATE DIRECTORY
  // -------------------------------------------------------
  //
  describe("createDirectory()", () => {
    it("should create directory successfully", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await service.createDirectory("1", "src/new-dir");

      expect(fs.mkdir).toHaveBeenCalledWith(path.join(mockApp.path, "src/new-dir"), {
        recursive: true,
      });
    });

    it("should create parent directories recursively", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await service.createDirectory("1", "a/b/c/d");

      const callArgs = (fs.mkdir as jest.Mock).mock.calls[0][1];
      expect(callArgs.recursive).toBe(true);
    });

    it("should throw 404 if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.createDirectory("999", "dir")).rejects.toThrow("App not found: 999");
    });

    it("should throw error on creation failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.mkdir as jest.Mock).mockRejectedValue(new Error("Permission denied"));

      await expect(service.createDirectory("1", "dir")).rejects.toThrow(
        "Failed to create directory: Permission denied"
      );
    });
  });

  //
  // -------------------------------------------------------
  // EXISTS
  // -------------------------------------------------------
  //
  describe("exists()", () => {
    it("should return true if file exists", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await service.exists("1", "index.js");

      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith(path.join(mockApp.path, "index.js"));
    });

    it("should return false if file does not exist", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.access as jest.Mock).mockRejectedValue(new Error("Not found"));

      const result = await service.exists("1", "missing.js");

      expect(result).toBe(false);
    });

    it("should return false if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.exists("999", "file.js");

      expect(result).toBe(false);
    });
  });

  //
  // -------------------------------------------------------
  // GET FILE STATS
  // -------------------------------------------------------
  //
  describe("getFileStats()", () => {
    it("should return file stats successfully", async () => {
      const mockStats = {
        size: 1024,
        isDirectory: jest.fn().mockReturnValue(false),
        isFile: jest.fn().mockReturnValue(true),
        birthtime: new Date("2025-01-01"),
        mtime: new Date("2025-01-02"),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);

      const result = await service.getFileStats("1", "index.js");

      expect(result.size).toBe(1024);
      expect(result.isDirectory).toBe(false);
      expect(result.isFile).toBe(true);
      expect(result.createdAt).toEqual(new Date("2025-01-01"));
      expect(result.modifiedAt).toEqual(new Date("2025-01-02"));
    });

    it("should return directory stats", async () => {
      const mockStats = {
        size: 4096,
        isDirectory: jest.fn().mockReturnValue(true),
        isFile: jest.fn().mockReturnValue(false),
        birthtime: new Date(),
        mtime: new Date(),
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);

      const result = await service.getFileStats("1", "src");

      expect(result.isDirectory).toBe(true);
      expect(result.isFile).toBe(false);
    });

    it("should throw 404 if file not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.stat as jest.Mock).mockRejectedValue({ code: "ENOENT" });

      await expect(service.getFileStats("1", "missing.js")).rejects.toThrow(
        "File not found: missing.js"
      );
    });

    it("should throw 404 if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getFileStats("999", "file.js")).rejects.toThrow("App not found: 999");
    });

    it("should throw error on stat failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp]),
      };

      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.stat as jest.Mock).mockRejectedValue(new Error("Permission denied"));

      await expect(service.getFileStats("1", "file.js")).rejects.toThrow(
        "Failed to get file stats: Permission denied"
      );
    });
  });
});
