import { PromptService, PromptConfig } from "../../src/services/prompt_service";
import fs from "fs";
import path from "path";

jest.mock("fs");
jest.mock("../../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("PromptService", () => {
  let service: PromptService;
  const mockAppPath = "/app/test-app";
  const aiRulesPath = path.join(mockAppPath, "AI_RULES.md");

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PromptService();
  });

  //
  // -------------------------------------------------------
  // READ AI RULES
  // -------------------------------------------------------
  //
  describe("readAiRules()", () => {
    it("should read AI_RULES.md from app directory", () => {
      const customRules = "# Custom Rules\n- Rule 1\n- Rule 2";
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(customRules);

      const result = service.readAiRules(mockAppPath);

      expect(result).toBe(customRules);
      expect(fs.existsSync).toHaveBeenCalledWith(aiRulesPath);
      expect(fs.readFileSync).toHaveBeenCalledWith(aiRulesPath, "utf8");
    });

    it("should return default rules when file does not exist", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = service.readAiRules(mockAppPath);

      expect(result).toContain("Tech Stack");
      expect(result).toContain("React");
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it("should handle read errors and return default rules", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const result = service.readAiRules(mockAppPath);

      expect(result).toContain("Tech Stack");
      expect(result).not.toContain("Custom");
    });

    it("should handle empty AI_RULES.md file", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue("");

      const result = service.readAiRules(mockAppPath);

      expect(result).toBe("");
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it("should handle very large AI_RULES.md file", () => {
      const largeRules = "# Rules\n" + "- Rule line\n".repeat(10000);
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(largeRules);

      const result = service.readAiRules(mockAppPath);

      expect(result).toBe(largeRules);
      expect(result.length).toBeGreaterThan(100000);
    });

    it("should handle special characters in AI_RULES.md", () => {
      const specialRules = "# Rules\n- Use `backticks`\n- Use ```code blocks```\n- Use <tags>";
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue(specialRules);

      const result = service.readAiRules(mockAppPath);

      expect(result).toBe(specialRules);
      expect(result).toContain("backticks");
      expect(result).toContain("<tags>");
    });

    it("should handle different app paths", () => {
      const otherAppPath = "/different/app/path";
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      service.readAiRules(otherAppPath);

      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join(otherAppPath, "AI_RULES.md")
      );
    });
  });

  //
  // -------------------------------------------------------
  // CONSTRUCT SYSTEM PROMPT
  // -------------------------------------------------------
  //
  describe("constructSystemPrompt()", () => {
    it("should construct basic prompt with auto-code mode", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("expert AI coding assistant");
      expect(result).toContain("Auto-Code Mode");
      expect(result).toContain("dyad");
    });

    it("should construct prompt with agent mode", () => {
      const config: PromptConfig = {
        chatMode: "agent",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Agent Mode");
      expect(result).toContain("step-by-step");
    });

    it("should construct prompt with ask mode", () => {
      const config: PromptConfig = {
        chatMode: "ask",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Ask Mode");
      expect(result).toContain("explanations");
      expect(result).toContain("DO NOT generate any code");
    });

    it("should construct prompt with custom mode", () => {
      const config: PromptConfig = {
        chatMode: "custom",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("expert AI coding assistant");
      expect(result).not.toContain("Auto-Code Mode");
      expect(result).not.toContain("Agent Mode");
      expect(result).not.toContain("Ask Mode");
    });

    it("should include AI rules in prompt when provided", () => {
      const customRules = "# Project-Specific Rules\n- Use TypeScript strict mode";
      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules: customRules,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Project-Specific Rules");
      expect(result).toContain("TypeScript strict mode");
    });

    it("should not include AI rules when not provided", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("expert AI coding assistant");
      // Project-Specific Rules heading should not be there without rules
      const hasProjectRulesHeading =
        result.includes("## Project-Specific Rules") &&
        result.indexOf("## Project-Specific Rules") >
          result.indexOf("expert AI coding assistant");
      expect(hasProjectRulesHeading).toBe(false);
    });

    it("should include turbo edits instructions when enabled", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        enableTurboEditsV2: true,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Search-Replace File Edits");
      expect(result).toContain("dyad-search-replace");
      expect(result).toContain("Turbo Edits V2");
    });

    it("should not include turbo edits when disabled", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        enableTurboEditsV2: false,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).not.toContain("Search-Replace File Edits");
      expect(result).not.toContain("dyad-search-replace");
    });

    it("should always include dyad tags reference", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Dyad Tags Reference");
      expect(result).toContain("dyad-write");
      expect(result).toContain("dyad-rename");
      expect(result).toContain("dyad-delete");
    });

    it("should include project template information", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Vite + React + shadcn/ui");
      expect(result).toContain("TypeScript");
      expect(result).toContain("Tailwind CSS");
      expect(result).toContain("React Router");
    });

    it("should include thinking process instructions", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("<think></think>");
      expect(result).toContain("Thinking Process");
    });

    it("should construct complete prompt with all features", () => {
      const customRules = "# Custom\n- Typescript";
      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules: customRules,
        enableTurboEditsV2: true,
        appName: "MyApp",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("expert AI coding assistant");
      expect(result).toContain("Auto-Code Mode");
      expect(result).toContain("Project-Specific Rules");
      expect(result).toContain("TypeScript");
      expect(result).toContain("Search-Replace File Edits");
      expect(result).toContain("Dyad Tags Reference");
      expect(result.length).toBeGreaterThan(5000);
    });

    it("should have consistent structure across modes", () => {
      const configs: PromptConfig[] = [
        { chatMode: "auto-code" },
        { chatMode: "agent" },
        { chatMode: "ask" },
        { chatMode: "custom" },
      ];

      configs.forEach((config) => {
        const result = service.constructSystemPrompt(config);

        // All should include base instructions
        expect(result).toContain("expert AI coding assistant");
        // All should include dyad tags
        expect(result).toContain("Dyad Tags Reference");
        // All should include project template
        expect(result).toContain("Vite + React + shadcn/ui");
      });
    });
  });

  //
  // -------------------------------------------------------
  // AUTO-CODE MODE SPECIFIC
  // -------------------------------------------------------
  //
  describe("Auto-Code Mode Instructions", () => {
    it("should emphasize dyad tags usage", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("ALWAYS use <dyad-write>");
      expect(result).toContain("MANDATORY");
      expect(result).toContain("Any code in ``` markdown blocks is a FAILURE");
    });

    it("should include Index.tsx update requirement", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("ALWAYS update src/pages/Index.tsx");
      expect(result).toContain("Users cannot see your work");
    });

    it("should include import resolution rules", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Import Rules");
      expect(result).toContain("Never leave imports unresolved");
    });

    it("should include React Router rules", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("React Router Rules");
      expect(result).toContain("BrowserRouter is ALREADY set up");
      expect(result).toContain("NEVER wrap <Routes> in a new <BrowserRouter>");
    });

    it("should include file organization rules", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("File Organization");
      expect(result).toContain("One component per file");
      expect(result).toContain("prefer < 100 lines");
    });
  });

  //
  // -------------------------------------------------------
  // AGENT MODE SPECIFIC
  // -------------------------------------------------------
  //
  describe("Agent Mode Instructions", () => {
    it("should emphasize thinking and planning", () => {
      const config: PromptConfig = {
        chatMode: "agent",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("step-by-step");
      expect(result).toContain("Plan your approach");
    });

    it("should allow asking clarifying questions", () => {
      const config: PromptConfig = {
        chatMode: "agent",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Ask clarifying questions");
    });
  });

  //
  // -------------------------------------------------------
  // ASK MODE SPECIFIC
  // -------------------------------------------------------
  //
  describe("Ask Mode Instructions", () => {
    it("should prohibit code generation", () => {
      const config: PromptConfig = {
        chatMode: "ask",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("ONLY provide explanations");
      expect(result).toContain("DO NOT generate any code");
      expect(result).toContain("do not make any changes to files");
    });

    it("should guide towards explanations and suggestions", () => {
      const config: PromptConfig = {
        chatMode: "ask",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Explain concepts clearly");
      expect(result).toContain("Suggest approaches");
      expect(result).toContain("best practices");
    });
  });

  //
  // -------------------------------------------------------
  // BASE INSTRUCTIONS
  // -------------------------------------------------------
  //
  describe("Base Instructions", () => {
    it("should include thinking process structure", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Thinking Process");
      expect(result).toContain("Identify the specific request");
      expect(result).toContain("Examine relevant parts");
      expect(result).toContain("Plan the implementation");
    });

    it("should include project template conventions", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("src/components/");
      expect(result).toContain("src/pages/");
      expect(result).toContain("src/lib/");
      expect(result).toContain("src/App.tsx");
    });

    it("should include component guidelines", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("functional components");
      expect(result).toContain("shadcn/ui components");
      expect(result).toContain("Tailwind CSS");
      expect(result).toContain("responsive design");
    });

    it("should include key principles", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Key Principles");
      expect(result).toContain("clean, idiomatic");
      expect(result).toContain("existing code style");
    });
  });

  //
  // -------------------------------------------------------
  // DYAD TAGS REFERENCE
  // -------------------------------------------------------
  //
  describe("Dyad Tags Reference", () => {
    it("should include write/create files section", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Write/Create Files");
      expect(result).toContain("dyad-write");
      expect(result).toContain("description attribute");
    });

    it("should include rename files section", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Rename Files");
      expect(result).toContain("dyad-rename");
      expect(result).toContain("from=");
    });

    it("should include delete files section", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Delete Files");
      expect(result).toContain("dyad-delete");
    });

    it("should include add dependencies section", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Add Dependencies");
      expect(result).toContain("dyad-add-dependency");
      expect(result).toContain("Use SPACES between packages");
    });

    it("should show complete dyad-write example", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("TodoItem.tsx");
      expect(result).toContain("export function");
    });
  });

  //
  // -------------------------------------------------------
  // TURBO EDITS V2 INSTRUCTIONS
  // -------------------------------------------------------
  //
  describe("Turbo Edits V2 Instructions", () => {
    it("should explain search-replace mechanism", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        enableTurboEditsV2: true,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("dyad-search-replace");
      expect(result).toContain("SURGICAL EDITS ONLY");
    });

    it("should include critical rules for search-replace", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        enableTurboEditsV2: true,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Critical Rules");
      expect(result).toContain("exactly ONE");
      expect(result).toContain("existing content section");
    });

    it("should provide search-replace format examples", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        enableTurboEditsV2: true,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("<<<<<<< SEARCH");
      expect(result).toContain("=======");
      expect(result).toContain(">>>>>>> REPLACE");
    });

    it("should explain when to use search-replace vs dyad-write", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        enableTurboEditsV2: true,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("When to use Search-Replace");
      expect(result).toContain("When to use dyad-write instead");
    });

    it("should show multiple edit example", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        enableTurboEditsV2: true,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("Multiple Edits in One Tag");
    });
  });

  //
  // -------------------------------------------------------
  // GET MAX CONTEXT TURNS
  // -------------------------------------------------------
  //
  describe("getMaxContextTurns()", () => {
    it("should return max context turns", () => {
      const result = service.getMaxContextTurns();

      expect(result).toBe(20);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThan(0);
    });

    it("should return consistent value", () => {
      const result1 = service.getMaxContextTurns();
      const result2 = service.getMaxContextTurns();

      expect(result1).toBe(result2);
    });
  });

  //
  // -------------------------------------------------------
  // INTEGRATION SCENARIOS
  // -------------------------------------------------------
  //
  describe("Integration Scenarios", () => {
    it("should generate complete auto-code prompt for new app", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      const customRules = "# Custom Rules\n- Use pnpm";
      (fs.readFileSync as jest.Mock).mockReturnValue(customRules);

      const aiRules = service.readAiRules(mockAppPath);
      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules,
        enableTurboEditsV2: true,
        appName: "MyApp",
      };

      const prompt = service.constructSystemPrompt(config);

      expect(prompt).toContain("expert AI coding assistant");
      expect(prompt).toContain("Auto-Code Mode");
      expect(prompt).toContain("Use pnpm");
      expect(prompt).toContain("dyad-search-replace");
      expect(prompt.length).toBeGreaterThan(10000);
    });

    it("should generate focused ask-mode prompt", () => {
      const config: PromptConfig = {
        chatMode: "ask",
      };

      const prompt = service.constructSystemPrompt(config);

      expect(prompt).toContain("Ask Mode");
      expect(prompt).toContain("DO NOT generate any code");
      // Ask mode still includes dyad reference in Dyad Tags section for reference
      expect(prompt).toContain("Explain concepts clearly");
    });

    it("should handle missing AI rules file gracefully", () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const aiRules = service.readAiRules(mockAppPath);
      expect(aiRules).toContain("Tech Stack");

      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules,
      };

      const prompt = service.constructSystemPrompt(config);

      expect(prompt).toContain("Tech Stack");
      expect(prompt).toContain("React");
    });

    it("should support all chat modes with custom rules", () => {
      const modes: Array<PromptConfig["chatMode"]> = [
        "auto-code",
        "agent",
        "ask",
        "custom",
      ];
      const customRules = "# Custom Rules";

      modes.forEach((mode) => {
        const config: PromptConfig = {
          chatMode: mode,
          aiRules: customRules,
        };

        const prompt = service.constructSystemPrompt(config);

        expect(prompt).toContain("expert AI coding assistant");
        expect(prompt).toContain("Custom Rules");
      });
    });

    it("should provide sufficient context for AI model", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules: "# Rules\n- Rule 1",
        enableTurboEditsV2: true,
      };

      const prompt = service.constructSystemPrompt(config);

      // Should have enough content for good AI response
      expect(prompt.split("\n").length).toBeGreaterThan(100);
      expect(prompt.length).toBeGreaterThan(10000);
    });

    it("should maintain prompt quality with all options enabled", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules: "# Custom AI Rules\n- TypeScript strict\n- Use tests",
        enableTurboEditsV2: true,
        appName: "SuperApp",
      };

      const prompt = service.constructSystemPrompt(config);

      // Verify all critical sections are present
      expect(prompt).toContain("thinking process");
      expect(prompt).toContain("Auto-Code Mode");
      expect(prompt).toContain("dyad-search-replace");
      expect(prompt).toContain("Dyad Tags Reference");
      expect(prompt).toContain("Project-Specific Rules");
      expect(prompt).toContain("TypeScript strict");
    });
  });

  //
  // -------------------------------------------------------
  // EDGE CASES
  // -------------------------------------------------------
  //
  describe("Edge Cases", () => {
    it("should handle null or undefined AI rules", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules: undefined,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("expert AI coding assistant");
      expect(result).not.toContain("Project-Specific Rules");
    });

    it("should handle empty string AI rules", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules: "",
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("expert AI coding assistant");
    });

    it("should handle very long app names", () => {
      const longName = "A".repeat(1000);
      const config: PromptConfig = {
        chatMode: "auto-code",
        appName: longName,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("expert AI coding assistant");
    });

    it("should handle special characters in app name", () => {
      const specialName = "app-@#$%-name";
      const config: PromptConfig = {
        chatMode: "auto-code",
        appName: specialName,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("expert AI coding assistant");
    });

    it("should handle multiple consecutive calls", () => {
      const config: PromptConfig = {
        chatMode: "auto-code",
      };

      const result1 = service.constructSystemPrompt(config);
      const result2 = service.constructSystemPrompt(config);
      const result3 = service.constructSystemPrompt(config);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });

    it("should preserve formatting in AI rules", () => {
      const rulesWithFormatting =
        "# Rules\n\n```typescript\ncode block\n```\n\n- List item";
      const config: PromptConfig = {
        chatMode: "auto-code",
        aiRules: rulesWithFormatting,
      };

      const result = service.constructSystemPrompt(config);

      expect(result).toContain("```typescript");
      expect(result).toContain("code block");
      expect(result).toContain("List item");
    });
  });
});
