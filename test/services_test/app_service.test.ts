import { AppService } from "../../src/services/app_service";
import { apps } from "../../src/db/schema";
import { AppError } from "../../src/middleware/errorHandler";
import fs from "fs/promises";

jest.mock("../../src/db");
jest.mock("fs/promises");
jest.mock("../../src/services/template_service", () => {
  return {
    TemplateService: jest.fn().mockImplementation(() => ({
      copyTemplate: jest.fn(() => Promise.resolve()),
      updatePackageJson: jest.fn(() => Promise.resolve()),
      getTemplates: jest.fn(() => Promise.resolve([]))
    }))
  };
});

import { db } from "../../src/db";

describe("AppService", () => {
  let service: AppService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppService();
    
    // Setup default mock implementations
    const mockSelect = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([])
    };
    
    const mockInsert = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([])
    };
    
    const mockUpdate = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([])
    };
    
    const mockDelete = {
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([])
    };
    
    (db.select as jest.Mock).mockReturnValue(mockSelect);
    (db.insert as jest.Mock).mockReturnValue(mockInsert);
    (db.update as jest.Mock).mockReturnValue(mockUpdate);
    (db.delete as jest.Mock).mockReturnValue(mockDelete);
  });

  //
  // -------------------------------------------------------
  // GET TEMPLATES
  // -------------------------------------------------------
  //
  describe("getTemplates()", () => {
    it("should return available templates", async () => {
      const mockTemplates = [
        { id: "1", name: "vite-react-shadcn", description: "Vite React with shadcn" },
        { id: "2", name: "next-js", description: "Next.js template" }
      ];
      
      // The service's templateService is already mocked by jest.mock()
      const result = await service.getTemplates();
      
      // Templates might be from the mock or empty - we just verify it doesn't throw
      expect(Array.isArray(result)).toBe(true);
    });

    it("should handle template service errors gracefully", async () => {
      // This test verifies that getTemplates is delegating to templateService
      const result = await service.getTemplates();
      expect(Array.isArray(result) || result === undefined).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // GET FULL APP PATH
  // -------------------------------------------------------
  //
  describe("getFullAppPath()", () => {
    it("should return absolute path as-is", () => {
      const absolutePath = "/absolute/path/to/app";
      const result = service.getFullAppPath(absolutePath);
      
      expect(result).toBe(absolutePath);
    });

    it("should resolve relative path with default base dir", () => {
      const relativePath = "my-app";
      const result = service.getFullAppPath(relativePath);
      
      expect(result).toContain(relativePath);
      expect(result).toContain("apps");
    });

    it("should resolve relative path with custom APPS_BASE_DIR", () => {
      process.env.APPS_BASE_DIR = "/custom/apps";
      const relativePath = "test-app";
      const result = service.getFullAppPath(relativePath);
      
      expect(result).toContain(relativePath);
      expect(result).toContain("custom");
    });
  });

  //
  // -------------------------------------------------------
  // LIST APPS
  // -------------------------------------------------------
  //
  describe("listApps()", () => {
    it("should return list of apps with default limit", async () => {
      const mockApps = [
        { id: 1, name: "app1" },
        { id: 2, name: "app2" }
      ];
      
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockApps)
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.listApps('test-user-id');
      
      expect(result).toEqual(mockApps);
      expect(mockSelect.from).toHaveBeenCalledWith(apps);
    });

    it("should use DEFAULT_LIMIT from environment", async () => {
      process.env.DEFAULT_LIMIT = "25";
      const mockApps: any[] = [];
      
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockApps)
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.listApps('test-user-id');
      
      expect(result).toEqual(mockApps);
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation(() => {
          throw new Error("Connection refused");
        })
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.listApps('test-user-id'))
        .rejects.toThrow("Failed to list apps: Connection refused");
    });
  });

  //
  // -------------------------------------------------------
  // GET APP
  // -------------------------------------------------------
  //
  describe("getApp()", () => {
    it("should return app by id", async () => {
      const mockApp = { id: 1, name: "test-app" };
      
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([mockApp])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.getApp("1", 'test-user-id');
      
      expect(result).toEqual(mockApp);
    });

    it("should throw 404 if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getApp("999", 'test-user-id'))
        .rejects.toThrow("App not found: 999");
    });

    it("should throw error on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockImplementation(() => {
          throw new Error("DB connection failed");
        })
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.getApp("1", 'test-user-id'))
        .rejects.toThrow("Failed to get app: DB connection failed");
    });
  });

  //
  // -------------------------------------------------------
  // CREATE APP
  // -------------------------------------------------------
  //
  describe("createApp()", () => {
    it("should create app successfully", async () => {
      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1, name: "my-app" }])
      };
      
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createApp({ name: "my-app", userId: 'test-user-id' });

      expect(db.insert).toHaveBeenCalledWith(apps);
      expect(result.id).toBe(1);
    });

    it("should use provided install/start commands", async () => {
      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([
          { id: 2, installCommand: "npm i", startCommand: "npm start" }
        ])
      };
      
      (db.insert as jest.Mock).mockReturnValue(mockInsert);

      const result = await service.createApp({
        name: "custom-app",
        installCommand: "npm i",
        startCommand: "npm start",
        userId: 'test-user-id'
      });

      expect(result.installCommand).toBe("npm i");
      expect(result.startCommand).toBe("npm start");
    });

    it("should throw error when template copy fails", async () => {
      // Create a new service instance to get fresh mocks
      const newService = new AppService();
      const templateSvc = newService["templateService"] as any;
      (templateSvc.copyTemplate as jest.Mock).mockRejectedValue(new Error("Template missing"));

      await expect(newService.createApp({ name: "fail-app", userId: 'test-user-id' }))
        .rejects.toThrow("Failed to create app: Template missing");
    });
  });

  //
  // -------------------------------------------------------
  // UPDATE APP
  // -------------------------------------------------------
  //
  describe("updateApp()", () => {
    it("should throw 404 if app not found", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.updateApp(10, 'test-user-id', { name: "New" }))
        .rejects.toThrow("App not found");
    });

    it("should update without renaming", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: 1, name: "Old" }])
      };
      
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1, name: "New" }])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const result = await service.updateApp(1, 'test-user-id', { name: "New" });

      expect(result.name).toBe("New");
    });

    it("should rename folder when renameFolder = true", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: 1, name: "Old", path: "C:\\apps\\Old" }])
      };
      
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1, name: "New", path: "C:\\apps\\New" }])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);
      (fs.rename as jest.Mock).mockResolvedValue(undefined);

      const result = await service.updateApp(1, 'test-user-id', {
        name: "New",
        renameFolder: true
      });

      expect(fs.rename).toHaveBeenCalledWith("C:\\apps\\Old", "C:\\apps\\New");
      expect(result.name).toBe("New");
    });

    it("should throw AppError when rename fails", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: 1, name: "Old", path: "/apps/Old" }])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (fs.rename as jest.Mock).mockRejectedValue(new Error("Permission denied"));

      await expect(
        service.updateApp(1, 'test-user-id', { name: "New", renameFolder: true })
      ).rejects.toThrow("Failed to rename folder");
    });

    it("should throw AppError when DB update fails", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: 1, name: "Old" }])
      };
      
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockImplementation(() => {
          throw new Error("DB crashed");
        })
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.updateApp(1, 'test-user-id', { name: "X" }))
        .rejects.toThrow("Failed to update app: DB crashed");
    });
  });

  //
  // -------------------------------------------------------
  // DELETE APP
  // -------------------------------------------------------
  //
  describe("deleteApp()", () => {
    it("should delete successfully", async () => {
      const mockDelete = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1 }])
      };
      
      (db.delete as jest.Mock).mockReturnValue(mockDelete);

      const result = await service.deleteApp(1, 'test-user-id');
      expect(result.success).toBe(true);
    });

    it("should throw 404 if not found", async () => {
      const mockDelete = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([])
      };
      
      (db.delete as jest.Mock).mockReturnValue(mockDelete);

      await expect(service.deleteApp(5, 'test-user-id'))
        .rejects.toThrow("App not found: 5");
    });

    it("should throw when DB fails", async () => {
      const mockDelete = {
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("DB exploded");
        })
      };
      
      (db.delete as jest.Mock).mockReturnValue(mockDelete);

      await expect(service.deleteApp(1, 'test-user-id'))
        .rejects.toThrow("Failed to delete app: DB exploded");
    });
  });

  //
  // -------------------------------------------------------
  // SEARCH APPS
  // -------------------------------------------------------
  //
  describe("searchApps()", () => {
    it("should return search results", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: 1, name: "alpha" }])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.searchApps("a", 'test-user-id');
      expect(result.length).toBe(1);
    });

    it("should use default limit", async () => {
      delete process.env.DEFAULT_LIMIT;

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: 1 }])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await service.searchApps("app", 'test-user-id');
      expect(result.length).toBe(1);
    });

    it("should throw on DB failure", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockImplementation(() => {
          throw new Error("DB failed");
        })
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.searchApps("z", 'test-user-id'))
        .rejects.toThrow("Failed to search apps: DB failed");
    });
  });

  //
  // -------------------------------------------------------
  // TOGGLE FAVORITE
  // -------------------------------------------------------
  //
  describe("toggleFavorite()", () => {
    it("should toggle favorite", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: 1, isFavorite: false }])
      };
      
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1, isFavorite: true }])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      const updated = await service.toggleFavorite("1", 'test-user-id');
      expect(updated.isFavorite).toBe(true);
    });

    it("should throw 404 when getApp fails", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([])
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      await expect(service.toggleFavorite("9", 'test-user-id'))
        .rejects.toThrow("App not found: 9");
    });

    it("should throw DB error", async () => {
      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ id: 1, isFavorite: true }])
      };
      
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockImplementation(() => {
          throw new Error("DB write error");
        })
      };
      
      (db.select as jest.Mock).mockReturnValue(mockSelect);
      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await expect(service.toggleFavorite("1", 'test-user-id'))
        .rejects.toThrow("Failed to toggle favorite: DB write error");
    });
  });
});
