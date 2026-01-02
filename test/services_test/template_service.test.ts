import { TemplateService } from "../../src/services/template_service";
import path from "path";

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    existsSync: jest.fn(),
    promises: {
      mkdir: jest.fn(),
      readdir: jest.fn(),
      copyFile: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
    },
  };
});

import fs from "fs";

const fsPromises = (fs as any).promises;

describe("TemplateService", () => {
  let service: TemplateService;

  const mockTemplatesDir = "/app/scaffold";
  const mockAppPath = "/app/test-app";

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all fs mocks to default
    (fs.existsSync as jest.Mock).mockReset();
    (fsPromises.mkdir as jest.Mock).mockReset();
    (fsPromises.readdir as jest.Mock).mockReset();
    (fsPromises.copyFile as jest.Mock).mockReset();
    (fsPromises.readFile as jest.Mock).mockReset();
    (fsPromises.writeFile as jest.Mock).mockReset();
    service = new TemplateService();
  });

  //
  // -------------------------------------------------------
  // GET TEMPLATES
  // -------------------------------------------------------
  //
  describe("getTemplates()", () => {
    it("should return list of available templates", async () => {
      const templates = await service.getTemplates();

      expect(templates).toBeDefined();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it("should include vite-react-shadcn template", async () => {
      const templates = await service.getTemplates();

      const viteTemplate = templates.find((t) => t.id === "vite-react-shadcn");
      expect(viteTemplate).toBeDefined();
      expect(viteTemplate?.name).toBe("Vite + React + shadcn/ui");
      expect(viteTemplate?.description).toContain("Modern React app");
    });

    it("should include blank template", async () => {
      const templates = await service.getTemplates();

      const blankTemplate = templates.find((t) => t.id === "blank");
      expect(blankTemplate).toBeDefined();
      expect(blankTemplate?.name).toBe("Blank");
      expect(blankTemplate?.description).toContain("Empty project");
    });

    it("should have all required template properties", async () => {
      const templates = await service.getTemplates();

      for (const template of templates) {
        expect(template).toHaveProperty("id");
        expect(template).toHaveProperty("name");
        expect(template).toHaveProperty("description");
        expect(typeof template.id).toBe("string");
        expect(typeof template.name).toBe("string");
        expect(typeof template.description).toBe("string");
      }
    });
  });

  //
  // -------------------------------------------------------
  // COPY TEMPLATE
  // -------------------------------------------------------
  //
  describe("copyTemplate()", () => {
    it("should create blank template directory", async () => {
      fsPromises.mkdir.mockResolvedValue(undefined);

      await service.copyTemplate("blank", mockAppPath);

      expect(fsPromises.mkdir).toHaveBeenCalledWith(mockAppPath, {
        recursive: true,
      });
    });

    it("should throw error for unknown template", async () => {
      await expect(
        service.copyTemplate("unknown-template", mockAppPath)
      ).rejects.toThrow("Unknown template: unknown-template");
    });

    it("should copy vite-react-shadcn template successfully", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir.mockResolvedValue([]);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      expect(fs.existsSync).toHaveBeenCalled();
      expect(fsPromises.mkdir).toHaveBeenCalled();
    });

    it("should throw error if template directory does not exist", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(
        service.copyTemplate("vite-react-shadcn", mockAppPath)
      ).rejects.toThrow("Template directory not found");
    });

    it("should handle both blank and vite templates", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir.mockResolvedValue([]);

      // Test blank
      await service.copyTemplate("blank", mockAppPath);
      expect(fsPromises.mkdir).toHaveBeenCalled();

      jest.clearAllMocks();

      // Test vite
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir.mockResolvedValue([]);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);
      expect(fs.existsSync).toHaveBeenCalled();
    });
  });

  //
  // -------------------------------------------------------
  // COPY DIRECTORY
  // -------------------------------------------------------
  //
  describe("copyDirectory() - private method via copyTemplate", () => {
    it("should copy files from source to destination", async () => {
      const mockFiles = [
        { name: "package.json", isDirectory: () => false },
        { name: "tsconfig.json", isDirectory: () => false },
        { name: "src", isDirectory: () => true },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce([]); // For src subdirectory
      fsPromises.copyFile.mockResolvedValue(undefined);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      // Verify mkdir and copyFile were called
      expect(fsPromises.mkdir).toHaveBeenCalled();
      expect(fsPromises.copyFile).toHaveBeenCalled();
    });

    it("should skip node_modules directory", async () => {
      const mockFiles = [
        { name: "node_modules", isDirectory: () => true },
        { name: "package.json", isDirectory: () => false },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce([]);
      fsPromises.copyFile.mockResolvedValue(undefined);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      // Verify node_modules was not recursively copied
      const copyFileCall = fsPromises.copyFile.mock.calls;
      expect(
        copyFileCall.some((call: any) => call[0].includes("node_modules"))
      ).toBe(false);
    });

    it("should skip .git directory", async () => {
      const mockFiles = [
        { name: ".git", isDirectory: () => true },
        { name: "package.json", isDirectory: () => false },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce([]);
      fsPromises.copyFile.mockResolvedValue(undefined);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      const copyFileCall = fsPromises.copyFile.mock.calls;
      expect(copyFileCall.some((call: any) => call[0].includes(".git"))).toBe(false);
    });

    it("should skip dist directory", async () => {
      const mockFiles = [
        { name: "dist", isDirectory: () => true },
        { name: "package.json", isDirectory: () => false },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce([]);
      fsPromises.copyFile.mockResolvedValue(undefined);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      const copyFileCall = fsPromises.copyFile.mock.calls;
      expect(copyFileCall.some((call: any) => call[0].includes("dist"))).toBe(false);
    });

    it("should skip lock files", async () => {
      const lockFiles = [
        { name: "pnpm-lock.yaml", isDirectory: () => false },
        { name: "package-lock.json", isDirectory: () => false },
        { name: "yarn.lock", isDirectory: () => false },
        { name: "package.json", isDirectory: () => false },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce(lockFiles)
        .mockResolvedValueOnce([]);
      fsPromises.copyFile.mockResolvedValue(undefined);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      const copyFileCalls = fsPromises.copyFile.mock.calls;
      const copiedFiles = copyFileCalls.map((call: any) => call[0]);

      expect(copiedFiles.some((f: string) => f.includes("pnpm-lock.yaml"))).toBe(false);
      expect(copiedFiles.some((f: string) => f.includes("package-lock.json"))).toBe(false);
      expect(copiedFiles.some((f: string) => f.includes("yarn.lock"))).toBe(false);
    });

    it("should handle nested directories", async () => {
      const srcFiles = [{ name: "utils", isDirectory: () => true }];
      const nestedFiles = [{ name: "helpers.ts", isDirectory: () => false }];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce(srcFiles)
        .mockResolvedValueOnce(nestedFiles)
        .mockResolvedValueOnce([]);
      fsPromises.copyFile.mockResolvedValue(undefined);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      // Verify nested directory was created and file was copied
      expect(fsPromises.mkdir).toHaveBeenCalled();
      expect(fsPromises.copyFile).toHaveBeenCalled();
    });

    it("should handle read errors gracefully", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      
      // Create a spy to track all readdir calls and reject on the first one
      let readdirCallCount = 0;
      fsPromises.readdir.mockImplementation(async () => {
        readdirCallCount++;
        if (readdirCallCount === 1) {
          throw new Error("Read error");
        }
        return [];
      });

      let errorThrown = false;
      let errorMessage = "";
      try {
        await service.copyTemplate("vite-react-shadcn", mockAppPath);
      } catch (error: any) {
        errorThrown = true;
        errorMessage = error.message;
      }
      
      expect(errorThrown).toBe(true);
      expect(errorMessage).toContain("Read error");
    });

    it("should handle copy file errors gracefully", async () => {
      const mockFiles = [{ name: "package.json", isDirectory: () => false }];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir.mockResolvedValue(mockFiles);
      fsPromises.copyFile.mockRejectedValue(new Error("Copy failed"));

      await expect(
        service.copyTemplate("vite-react-shadcn", mockAppPath)
      ).rejects.toThrow("Copy failed");
    });
  });

  //
  // -------------------------------------------------------
  // UPDATE PACKAGE.JSON
  // -------------------------------------------------------
  //
  describe("updatePackageJson()", () => {
    it("should update package.json with app name", async () => {
      const packageJsonPath = path.join(mockAppPath, "package.json");
      const originalContent = JSON.stringify({
        name: "scaffold",
        version: "1.0.0",
      });

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockResolvedValue(originalContent);
      fsPromises.writeFile.mockResolvedValue(undefined);

      await service.updatePackageJson(mockAppPath, "My Test App");

      expect(fsPromises.readFile).toHaveBeenCalledWith(packageJsonPath, "utf-8");
      expect(fsPromises.writeFile).toHaveBeenCalled();

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      expect(writtenContent.name).toBe("my-test-app");
    });

    it("should convert app name to kebab-case", async () => {
      const originalContent = JSON.stringify({
        name: "scaffold",
        version: "1.0.0",
      });

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockResolvedValue(originalContent);
      fsPromises.writeFile.mockResolvedValue(undefined);

      await service.updatePackageJson(mockAppPath, "My Test App Name");

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      expect(writtenContent.name).toBe("my-test-app-name");
    });

    it("should preserve other package.json properties", async () => {
      const originalPackage = {
        name: "scaffold",
        version: "1.0.0",
        description: "Test app",
        scripts: { test: "jest" },
      };
      const originalContent = JSON.stringify(originalPackage);

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockResolvedValue(originalContent);
      fsPromises.writeFile.mockResolvedValue(undefined);

      await service.updatePackageJson(mockAppPath, "New App");

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      expect(writtenContent.version).toBe("1.0.0");
      expect(writtenContent.description).toBe("Test app");
      expect(writtenContent.scripts).toEqual({ test: "jest" });
    });

    it("should skip update if package.json does not exist", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await service.updatePackageJson(mockAppPath, "New App");

      expect(fsPromises.readFile).not.toHaveBeenCalled();
      expect(fsPromises.writeFile).not.toHaveBeenCalled();
    });

    it("should handle read errors", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockRejectedValue(new Error("Read failed"));

      await expect(
        service.updatePackageJson(mockAppPath, "New App")
      ).rejects.toThrow("Read failed");
    });

    it("should handle write errors", async () => {
      const originalContent = JSON.stringify({
        name: "scaffold",
        version: "1.0.0",
      });

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockResolvedValue(originalContent);
      fsPromises.writeFile.mockRejectedValue(new Error("Write failed"));

      await expect(
        service.updatePackageJson(mockAppPath, "New App")
      ).rejects.toThrow("Write failed");
    });

    it("should handle invalid JSON gracefully", async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockResolvedValue("invalid json");

      await expect(
        service.updatePackageJson(mockAppPath, "New App")
      ).rejects.toThrow();
    });

    it("should format package.json with proper indentation", async () => {
      const originalContent = JSON.stringify({ name: "scaffold" });

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockResolvedValue(originalContent);
      fsPromises.writeFile.mockResolvedValue(undefined);

      await service.updatePackageJson(mockAppPath, "Test App");

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = writeCall[1];

      // Check for 2-space indentation
      expect(writtenContent).toContain("  ");
    });

    it("should handle whitespace in app names", async () => {
      const originalContent = JSON.stringify({ name: "scaffold" });

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockResolvedValue(originalContent);
      fsPromises.writeFile.mockResolvedValue(undefined);

      await service.updatePackageJson(mockAppPath, "App    With   Spaces");

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      expect(writtenContent.name).toBe("app-with-spaces");
    });

    it("should handle special characters in app names", async () => {
      const originalContent = JSON.stringify({ name: "scaffold" });

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.readFile.mockResolvedValue(originalContent);
      fsPromises.writeFile.mockResolvedValue(undefined);

      await service.updatePackageJson(mockAppPath, "MyApp@123");

      const writeCall = fsPromises.writeFile.mock.calls[0];
      const writtenContent = JSON.parse(writeCall[1]);

      // Special characters get lowercased but not removed by the service
      expect(writtenContent.name).toBe("myapp@123");
    });
  });

  //
  // -------------------------------------------------------
  // SKIP PATTERNS
  // -------------------------------------------------------
  //
  describe("shouldSkipFile() - via template copy", () => {
    it("should skip all documented skip patterns", async () => {
      const skipPatterns = [
        "node_modules",
        ".git",
        ".DS_Store",
        "dist",
        "build",
        ".vite",
        ".turbo",
        "pnpm-lock.yaml",
        "package-lock.json",
        "yarn.lock",
      ];

      const mockFiles = skipPatterns.map((name) => ({
        name,
        isDirectory: () => name !== ".DS_Store",
      }));

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce([]);
      fsPromises.copyFile.mockResolvedValue(undefined);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      // Verify no files were copied (all should be skipped)
      expect(fsPromises.copyFile).not.toHaveBeenCalled();
    });

    it("should include files not in skip list", async () => {
      const normalFiles = [
        { name: "package.json", isDirectory: () => false },
        { name: "tsconfig.json", isDirectory: () => false },
        { name: "README.md", isDirectory: () => false },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir.mockResolvedValue(normalFiles);
      fsPromises.copyFile.mockResolvedValue(undefined);

      await service.copyTemplate("vite-react-shadcn", mockAppPath);

      // Verify copyFile was called at least once for the non-skipped files
      expect(fsPromises.copyFile).toHaveBeenCalled();
    });
  });

  //
  // -------------------------------------------------------
  // INTEGRATION
  // -------------------------------------------------------
  //
  describe("template workflow", () => {
    it("should complete full template setup", async () => {
      const mockFiles = [
        { name: "package.json", isDirectory: () => false },
        { name: "src", isDirectory: () => true },
      ];

      (fs.existsSync as jest.Mock).mockReturnValue(true);
      fsPromises.mkdir.mockResolvedValue(undefined);
      fsPromises.readdir
        .mockResolvedValueOnce(mockFiles)
        .mockResolvedValueOnce([]);
      fsPromises.copyFile.mockResolvedValue(undefined);
      fsPromises.readFile.mockResolvedValue(JSON.stringify({ name: "scaffold" }));
      fsPromises.writeFile.mockResolvedValue(undefined);

      // Get templates
      const templates = await service.getTemplates();
      expect(templates.length).toBeGreaterThan(0);

      // Copy template
      await service.copyTemplate("vite-react-shadcn", mockAppPath);
      expect(fsPromises.mkdir).toHaveBeenCalled();

      // Update package.json
      await service.updatePackageJson(mockAppPath, "My New App");
      expect(fsPromises.writeFile).toHaveBeenCalled();
    });

    it("should handle blank template workflow", async () => {
      fsPromises.mkdir.mockResolvedValue(undefined);

      const templates = await service.getTemplates();
      expect(templates.some((t) => t.id === "blank")).toBe(true);

      await service.copyTemplate("blank", mockAppPath);
      expect(fsPromises.mkdir).toHaveBeenCalledWith(mockAppPath, {
        recursive: true,
      });
    });

    it("should validate template before operations", async () => {
      const templates = await service.getTemplates();

      for (const template of templates) {
        expect(template.id).toBeTruthy();
        expect(template.name).toBeTruthy();
        expect(template.description).toBeTruthy();
      }
    });
  });
});
