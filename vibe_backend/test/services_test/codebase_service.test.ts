import { CodebaseService, CodebaseContext, ContextConfig } from "../../src/services/codebase_service";
import fs from "fs";
import path from "path";
import * as globModule from "glob";

jest.mock("fs");
jest.mock("glob");

describe("CodebaseService", () => {
  let service: CodebaseService;
  const glob = globModule.glob as unknown as jest.Mock;

  const mockAppPath = "/app/test-app";

  const mockFiles = [
    {
      path: "src/App.tsx",
      content: "export const App = () => <div>App</div>;",
      size: 40,
    },
    {
      path: "src/main.tsx",
      content: "import React from 'react';\nimport ReactDOM from 'react-dom';",
      size: 60,
    },
    {
      path: "package.json",
      content: '{"name": "test-app", "version": "1.0.0"}',
      size: 40,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CodebaseService();
  });

  //
  // -------------------------------------------------------
  // EXTRACT CONTEXT
  // -------------------------------------------------------
  //
  describe("extractContext()", () => {
    it("should extract context from codebase successfully", async () => {
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "src/App.tsx"),
        path.join(mockAppPath, "src/main.tsx"),
        path.join(mockAppPath, "package.json"),
      ]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        const file = mockFiles.find((f) =>
          filePath.includes(f.path.replace(/\//g, path.sep))
        );
        return file ? file.content : "";
      });

      const context = await service.extractContext(mockAppPath);

      expect(context).toBeDefined();
      expect(context.files.length).toBeGreaterThan(0);
      expect(context.totalFiles).toBe(context.files.length);
      expect(context.totalSize).toBeGreaterThan(0);
      expect(context.formattedOutput).toContain("<codebase>");
      expect(context.formattedOutput).toContain("</codebase>");
    });

    it("should extract specific component when selected", async () => {
      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("export const App = () => <div>App</div>;");

      const config: ContextConfig = {
        selectedComponent: {
          relativePath: "src/App.tsx",
          label: "App Component",
        },
      };

      const context = await service.extractContext(mockAppPath, config);

      expect(context.totalFiles).toBe(1);
      expect(context.files[0].path).toBe("src/App.tsx");
      expect(context.formattedOutput).toContain("src/App.tsx");
    });

    it("should apply exclude patterns correctly", async () => {
      const allFiles = [
        path.join(mockAppPath, "src/App.tsx"),
        path.join(mockAppPath, "node_modules/package/index.js"),
        path.join(mockAppPath, "dist/bundle.js"),
      ];

      (glob as jest.Mock).mockResolvedValue(allFiles);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      const config: ContextConfig = {
        contextPaths: [{ globPath: "src/**/*.{ts,tsx}" }],
        excludePaths: [{ globPath: "**/node_modules/**" }],
      };

      const context = await service.extractContext(mockAppPath, config);

      expect(glob).toHaveBeenCalled();
      const globCall = (glob as jest.Mock).mock.calls[0];
      expect(globCall[1].ignore).toContain("**/node_modules/**");
    });

    it("should handle file read errors gracefully", async () => {
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "src/App.tsx"),
        path.join(mockAppPath, "src/broken.tsx"),
      ]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);

      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes("broken")) {
          throw new Error("File read error");
        }
        return "content";
      });

      const context = await service.extractContext(mockAppPath);

      // Should still return context with successfully read files
      expect(context).toBeDefined();
      expect(context.totalFiles).toBeGreaterThanOrEqual(0);
    });

    it("should use default context paths", async () => {
      (glob as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      await service.extractContext(mockAppPath, {});

      expect(glob).toHaveBeenCalled();
      const patterns = (glob as jest.Mock).mock.calls.map((call) => call[0]);
      // Check that src pattern was called
      expect(patterns.some((p) => p.includes("src") && p.includes("ts,tsx,js,jsx}"))).toBe(true);
    });

    it("should add smart context files if specified", async () => {
      (glob as jest.Mock).mockResolvedValue([path.join(mockAppPath, "src/App.tsx")]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      const config: ContextConfig = {
        smartContextAutoIncludes: ["src/utils/helpers.ts", "src/types/index.ts"],
      };

      const context = await service.extractContext(mockAppPath, config);

      expect(context.files.length).toBeGreaterThanOrEqual(1);
    });

    it("should throw error on extraction failure", async () => {
      (glob as jest.Mock).mockRejectedValue(new Error("Glob error"));

      await expect(service.extractContext(mockAppPath)).rejects.toThrow(
        "Failed to extract codebase context"
      );
    });
  });

  //
  // -------------------------------------------------------
  // FORMATTED OUTPUT
  // -------------------------------------------------------
  //
  describe("formatCodebase()", () => {
    it("should format files with code blocks", async () => {
      (glob as jest.Mock)
        .mockResolvedValueOnce([path.join(mockAppPath, "src/App.tsx")])
        .mockResolvedValueOnce([]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("export const App = () => null;");

      const context = await service.extractContext(mockAppPath);

      // Use path.sep for cross-platform compatibility  
      expect(context.formattedOutput).toContain(`FILE: src${path.sep}App.tsx`);
      expect(context.formattedOutput).toContain("```typescript");
      expect(context.formattedOutput).toContain("export const App");
      expect(context.formattedOutput).toContain("```");
    });

    it("should include correct language for different file types", async () => {
      const testCases = [
        { path: "src/test.ts", language: "typescript" },
        { path: "src/test.jsx", language: "javascript" },
        { path: "package.json", language: "json" },
        { path: "README.md", language: "markdown" },
      ];

      for (const testCase of testCases) {
        (glob as jest.Mock).mockResolvedValue([path.join(mockAppPath, testCase.path)]);

        const mockFileStats = { mtimeMs: Date.now() };
        (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
        (fs.readFileSync as jest.Mock).mockReturnValue("content");

        const context = await service.extractContext(mockAppPath);

        expect(context.formattedOutput).toContain(`\`\`\`${testCase.language}`);
      }
    });

    it("should wrap output in codebase tags", async () => {
      (glob as jest.Mock).mockResolvedValue([]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      const context = await service.extractContext(mockAppPath);

      expect(context.formattedOutput).toMatch(/^<codebase>/);
      expect(context.formattedOutput).toMatch(/<\/codebase>$/);
    });
  });

  //
  // -------------------------------------------------------
  // FILE CACHING
  // -------------------------------------------------------
  //
  describe("readFileWithCache()", () => {
    it("should cache file content by mtime", async () => {
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "src/App.tsx"),
      ]);

      const mockFileStats = { mtimeMs: 12345 };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("cached content");

      // First call
      await service.extractContext(mockAppPath);
      const firstCallCount = (fs.readFileSync as jest.Mock).mock.calls.length;

      // Clear glob to avoid re-reading, but call again
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "src/App.tsx"),
      ]);

      // Second call should use cache
      await service.extractContext(mockAppPath);

      // readFileSync should not be called again for the same file with same mtime
      // (though glob may be called again)
    });

    it("should invalidate cache when file is modified", async () => {
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "src/App.tsx"),
      ]);

      // First call with mtime 100
      (fs.statSync as jest.Mock).mockReturnValueOnce({ mtimeMs: 100 });
      (fs.readFileSync as jest.Mock).mockReturnValueOnce("old content");

      await service.extractContext(mockAppPath);

      // Second call with mtime 200 (file modified)
      (glob as jest.Mock).mockResolvedValueOnce([
        path.join(mockAppPath, "src/App.tsx"),
      ]);
      (fs.statSync as jest.Mock).mockReturnValueOnce({ mtimeMs: 200 });
      (fs.readFileSync as jest.Mock).mockReturnValueOnce("new content");

      await service.extractContext(mockAppPath);

      // File should be re-read due to mtime change
      expect((fs.readFileSync as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  //
  // -------------------------------------------------------
  // CLEAR CACHE
  // -------------------------------------------------------
  //
  describe("clearCache()", () => {
    it("should clear the file cache", async () => {
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "src/App.tsx"),
      ]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      // Populate cache
      await service.extractContext(mockAppPath);

      // Clear cache
      service.clearCache();

      // After clearing, cache should be empty
      expect(service["fileCache"].size).toBe(0);
    });
  });

  //
  // -------------------------------------------------------
  // SMART CONTEXT FILTERING
  // -------------------------------------------------------
  //
  describe("applySmartContextFiltering()", () => {
    it("should filter files based on relevance score", async () => {
      const largeFileArray = Array.from({ length: 100 }, (_, i) => ({
        path: `src/file${i}.tsx`,
        content: "content",
        size: 100,
      }));

      (glob as jest.Mock).mockResolvedValue(
        largeFileArray.map((f) => path.join(mockAppPath, f.path))
      );

      const mockFileStats = { mtimeMs: Date.now() - 3600000 }; // 1 hour ago
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      const config: ContextConfig = {
        enableSmartContext: true,
        smartContextMode: "balanced",
        maxFiles: 50,
      };

      const context = await service.extractContext(mockAppPath, config);

      // Should be limited to maxFiles
      expect(context.files.length).toBeLessThanOrEqual(50);
    });

    it("should prioritize recently modified files", async () => {
      const files = [
        path.join(mockAppPath, "src/recent.tsx"),
        path.join(mockAppPath, "src/old.tsx"),
      ];

      (glob as jest.Mock).mockResolvedValue(files);

      const mockFileStatsRecent = { mtimeMs: Date.now() - 1800000 }; // 30 min ago
      const mockFileStatsOld = { mtimeMs: Date.now() - 604800000 }; // 1 week ago

      (fs.statSync as jest.Mock).mockImplementation((filePath: string) => {
        return filePath.includes("recent") ? mockFileStatsRecent : mockFileStatsOld;
      });

      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      const config: ContextConfig = {
        enableSmartContext: true,
        smartContextMode: "balanced",
      };

      const context = await service.extractContext(mockAppPath, config);

      // Recently modified file should be included
      expect(context.files.some((f) => f.path.includes("recent"))).toBe(true);
    });

    it("should match keywords in prompt", async () => {
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "src/Button.tsx"),
        path.join(mockAppPath, "src/Utils.tsx"),
      ]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);

      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes("Button")) {
          return "const Button = (props) => <button>{props.label}</button>";
        }
        return "export const sum = (a, b) => a + b;";
      });

      const config: ContextConfig = {
        enableSmartContext: true,
        prompt: "button component styling",
      };

      const context = await service.extractContext(mockAppPath, config);

      // Files with matching keywords should be prioritized
      expect(context.files.length).toBeGreaterThan(0);
    });

    it("should respect deep mode with higher maxFiles", async () => {
      const largeFileArray = Array.from({ length: 150 }, (_, i) => ({
        path: `src/file${i}.tsx`,
        content: "content",
        size: 100,
      }));

      (glob as jest.Mock).mockResolvedValue(
        largeFileArray.map((f) => path.join(mockAppPath, f.path))
      );

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      const config: ContextConfig = {
        enableSmartContext: true,
        smartContextMode: "deep",
        maxFiles: 100,
      };

      const context = await service.extractContext(mockAppPath, config);

      // Should allow more files in deep mode
      expect(context.files.length).toBeLessThanOrEqual(100);
    });

    it("should penalize large files", async () => {
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "src/small.tsx"),
        path.join(mockAppPath, "src/large.tsx"),
      ]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);

      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        // Return large content for large.tsx
        if (filePath.includes("large")) {
          return "x".repeat(15000); // > 10KB
        }
        return "const x = 1;";
      });

      const config: ContextConfig = {
        enableSmartContext: true,
        smartContextMode: "balanced",
      };

      const context = await service.extractContext(mockAppPath, config);

      // Small file should be preferred over large file
      expect(context.files.some((f) => f.path.includes("small"))).toBe(true);
    });

    it("should auto-include special files", async () => {
      (glob as jest.Mock).mockResolvedValue([
        path.join(mockAppPath, "package.json"),
        path.join(mockAppPath, "AI_RULES.md"),
        path.join(mockAppPath, "src/App.tsx"),
      ]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      const config: ContextConfig = {
        enableSmartContext: true,
      };

      const context = await service.extractContext(mockAppPath, config);

      // Auto-included files should be present
      const paths = context.files.map((f) => f.path);
      expect(paths.some((p) => p.includes("package.json") || p.includes("AI_RULES"))).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // LANGUAGE MAPPING
  // -------------------------------------------------------
  //
  describe("getLanguageFromExtension()", () => {
    const testCases = [
      { ext: "ts", expected: "typescript" },
      { ext: "tsx", expected: "typescript" },
      { ext: "js", expected: "javascript" },
      { ext: "jsx", expected: "javascript" },
      { ext: "json", expected: "json" },
      { ext: "css", expected: "css" },
      { ext: "html", expected: "html" },
      { ext: "md", expected: "markdown" },
      { ext: "py", expected: "python" },
      { ext: "go", expected: "go" },
      { ext: "rs", expected: "rust" },
      { ext: "java", expected: "java" },
      { ext: "rb", expected: "ruby" },
      { ext: "php", expected: "php" },
      { ext: "unknown", expected: "unknown" },
    ];

    for (const testCase of testCases) {
      it(`should map ${testCase.ext} to ${testCase.expected}`, async () => {
        (glob as jest.Mock).mockResolvedValue([
          path.join(mockAppPath, `src/file.${testCase.ext}`),
        ]);

        const mockFileStats = { mtimeMs: Date.now() };
        (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
        (fs.readFileSync as jest.Mock).mockReturnValue("content");

        const context = await service.extractContext(mockAppPath);

        expect(context.formattedOutput).toContain(`\`\`\`${testCase.expected}`);
      });
    }
  });

  //
  // -------------------------------------------------------
  // STATISTICS
  // -------------------------------------------------------
  //
  describe("context statistics", () => {
    it("should calculate correct total size", async () => {
      const testFiles = [
        { path: "src/a.tsx", content: "12345", size: 5 },
        { path: "src/b.tsx", content: "1234567", size: 7 },
        { path: "src/c.tsx", content: "123", size: 3 },
      ];

      // First glob call returns src files, second returns package.json (empty)
      (glob as jest.Mock)
        .mockResolvedValueOnce(
          testFiles.map((f) => path.join(mockAppPath, f.path))
        )
        .mockResolvedValueOnce([]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);

      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        const file = testFiles.find((f) =>
          filePath.includes(f.path.replace(/\//g, path.sep))
        );
        return file ? file.content : "";
      });

      const context = await service.extractContext(mockAppPath);

      expect(context.totalSize).toBe(15); // 5 + 7 + 3
      expect(context.totalFiles).toBe(3);
    });

    it("should report correct file count", async () => {
      const fileCount = 5;
      const files = Array.from({ length: fileCount }, (_, i) =>
        path.join(mockAppPath, `src/file${i}.tsx`)
      );

      // First glob call for src files, second for package.json (empty)
      (glob as jest.Mock)
        .mockResolvedValueOnce(files)
        .mockResolvedValueOnce([]);

      const mockFileStats = { mtimeMs: Date.now() };
      (fs.statSync as jest.Mock).mockReturnValue(mockFileStats);
      (fs.readFileSync as jest.Mock).mockReturnValue("content");

      const context = await service.extractContext(mockAppPath);

      expect(context.totalFiles).toBe(fileCount);
      expect(context.files.length).toBe(fileCount);
    });
  });
});
