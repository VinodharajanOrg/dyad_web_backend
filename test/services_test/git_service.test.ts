import { GitService } from "../../src/services/git_service";
import git from "isomorphic-git";
import fs from "fs";
import http from "isomorphic-git/http/node";
import path from "path";

jest.mock("isomorphic-git");
jest.mock("isomorphic-git/http/node");

describe("GitService", () => {
  let service: GitService;

  const mockAppId = "test-app-123";
  const mockRepoPath = path.join(process.env.DATA_DIR || path.join(__dirname, "../../data/apps"), mockAppId);

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GitService();
  });

  //
  // -------------------------------------------------------
  // INIT
  // -------------------------------------------------------
  //
  describe("init()", () => {
    it("should initialize git repo successfully", async () => {
      (git.init as jest.Mock).mockResolvedValue(undefined);

      await service.init(mockAppId);

      expect(git.init).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
      });
    });

    it("should throw error on init failure", async () => {
      (git.init as jest.Mock).mockRejectedValue(new Error("Permission denied"));

      await expect(service.init(mockAppId)).rejects.toThrow(
        "Failed to initialize git repo: Permission denied"
      );
    });

    it("should handle git already initialized error", async () => {
      (git.init as jest.Mock).mockRejectedValue(new Error("Already initialized"));

      await expect(service.init(mockAppId)).rejects.toThrow(
        "Failed to initialize git repo: Already initialized"
      );
    });
  });

  //
  // -------------------------------------------------------
  // CLONE
  // -------------------------------------------------------
  //
  describe("clone()", () => {
    const mockUrl = "https://github.com/user/repo.git";

    it("should clone repository successfully", async () => {
      (git.clone as jest.Mock).mockResolvedValue(undefined);

      await service.clone(mockAppId, mockUrl);

      expect(git.clone).toHaveBeenCalledWith({
        fs,
        http,
        dir: mockRepoPath,
        url: mockUrl,
        singleBranch: true,
        depth: 1,
      });
    });

    it("should throw error on clone failure", async () => {
      (git.clone as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(service.clone(mockAppId, mockUrl)).rejects.toThrow(
        "Failed to clone repository: Network error"
      );
    });

    it("should throw error on invalid repository URL", async () => {
      (git.clone as jest.Mock).mockRejectedValue(new Error("Invalid URL"));

      await expect(service.clone(mockAppId, "invalid-url")).rejects.toThrow(
        "Failed to clone repository: Invalid URL"
      );
    });

    it("should throw error on repository not found", async () => {
      (git.clone as jest.Mock).mockRejectedValue(new Error("404 Not Found"));

      await expect(service.clone(mockAppId, "https://github.com/nonexistent/repo.git")).rejects.toThrow(
        "Failed to clone repository: 404 Not Found"
      );
    });
  });

  //
  // -------------------------------------------------------
  // ADD
  // -------------------------------------------------------
  //
  describe("add()", () => {
    it("should add all files successfully", async () => {
      (git.add as jest.Mock).mockResolvedValue(undefined);

      await service.add(mockAppId);

      expect(git.add).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
        filepath: ".",
      });
    });

    it("should add specific file successfully", async () => {
      (git.add as jest.Mock).mockResolvedValue(undefined);

      await service.add(mockAppId, "src/index.js");

      expect(git.add).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
        filepath: "src/index.js",
      });
    });

    it("should throw error when adding non-existent file", async () => {
      (git.add as jest.Mock).mockRejectedValue(new Error("File not found"));

      await expect(service.add(mockAppId, "nonexistent.js")).rejects.toThrow(
        "Failed to add files: File not found"
      );
    });

    it("should throw error on add failure", async () => {
      (git.add as jest.Mock).mockRejectedValue(new Error("Not a git repository"));

      await expect(service.add(mockAppId)).rejects.toThrow(
        "Failed to add files: Not a git repository"
      );
    });
  });

  //
  // -------------------------------------------------------
  // COMMIT
  // -------------------------------------------------------
  //
  describe("commit()", () => {
    it("should commit changes with default author", async () => {
      const mockSha = "abc123def456";
      (git.commit as jest.Mock).mockResolvedValue(mockSha);

      const result = await service.commit(mockAppId, "Initial commit");

      expect(git.commit).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
        message: "Initial commit",
        author: {
          name: "Dyad",
          email: "dyad@app.com",
        },
      });
      expect(result).toBe(mockSha);
    });

    it("should commit changes with custom author", async () => {
      const mockSha = "abc123def456";
      const customAuthor = { name: "John Doe", email: "john@example.com" };

      (git.commit as jest.Mock).mockResolvedValue(mockSha);

      const result = await service.commit(mockAppId, "Fix bug", customAuthor);

      expect(git.commit).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
        message: "Fix bug",
        author: customAuthor,
      });
      expect(result).toBe(mockSha);
    });

    it("should return commit SHA", async () => {
      const mockSha = "abc123def456";
      (git.commit as jest.Mock).mockResolvedValue(mockSha);

      const result = await service.commit(mockAppId, "Update readme");

      expect(result).toBe(mockSha);
    });

    it("should throw error when nothing to commit", async () => {
      (git.commit as jest.Mock).mockRejectedValue(new Error("Nothing to commit"));

      await expect(service.commit(mockAppId, "Empty commit")).rejects.toThrow(
        "Failed to commit: Nothing to commit"
      );
    });

    it("should throw error on commit failure", async () => {
      (git.commit as jest.Mock).mockRejectedValue(new Error("Merge conflict"));

      await expect(service.commit(mockAppId, "Merge")).rejects.toThrow(
        "Failed to commit: Merge conflict"
      );
    });
  });

  //
  // -------------------------------------------------------
  // LOG
  // -------------------------------------------------------
  //
  describe("log()", () => {
    it("should get commit log successfully", async () => {
      const mockCommits = [
        {
          oid: "abc123",
          commit: {
            message: "Initial commit",
            author: { name: "Dyad", email: "dyad@app.com", timestamp: 1000 },
          },
        },
        {
          oid: "def456",
          commit: {
            message: "Fix bug",
            author: { name: "John Doe", email: "john@example.com", timestamp: 2000 },
          },
        },
      ];

      (git.log as jest.Mock).mockResolvedValue(mockCommits);

      const result = await service.log(mockAppId);

      expect(git.log).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
        depth: 10,
      });
      expect(result).toHaveLength(2);
      expect(result[0].oid).toBe("abc123");
      expect(result[0].message).toBe("Initial commit");
    });

    it("should get commit log with custom depth", async () => {
      (git.log as jest.Mock).mockResolvedValue([]);

      await service.log(mockAppId, 50);

      expect(git.log).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
        depth: 50,
      });
    });

    it("should handle empty repository", async () => {
      (git.log as jest.Mock).mockResolvedValue([]);

      const result = await service.log(mockAppId);

      expect(result).toEqual([]);
    });

    it("should map commit data correctly", async () => {
      const mockCommits = [
        {
          oid: "abc123",
          commit: {
            message: "Test commit",
            author: { name: "Tester", email: "test@example.com", timestamp: 1609459200 },
          },
        },
      ];

      (git.log as jest.Mock).mockResolvedValue(mockCommits);

      const result = await service.log(mockAppId);

      expect(result[0]).toHaveProperty("oid");
      expect(result[0]).toHaveProperty("message");
      expect(result[0]).toHaveProperty("author");
      expect(result[0]).toHaveProperty("timestamp");
    });

    it("should throw error on log failure", async () => {
      (git.log as jest.Mock).mockRejectedValue(new Error("Not a git repository"));

      await expect(service.log(mockAppId)).rejects.toThrow(
        "Failed to get commit log: Not a git repository"
      );
    });
  });

  //
  // -------------------------------------------------------
  // CHECKOUT
  // -------------------------------------------------------
  //
  describe("checkout()", () => {
    it("should checkout branch successfully", async () => {
      (git.checkout as jest.Mock).mockResolvedValue(undefined);

      await service.checkout(mockAppId, "main");

      expect(git.checkout).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
        ref: "main",
      });
    });

    it("should checkout commit SHA", async () => {
      (git.checkout as jest.Mock).mockResolvedValue(undefined);

      await service.checkout(mockAppId, "abc123def456");

      expect(git.checkout).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
        ref: "abc123def456",
      });
    });

    it("should throw error when branch not found", async () => {
      (git.checkout as jest.Mock).mockRejectedValue(new Error("Branch not found"));

      await expect(service.checkout(mockAppId, "nonexistent-branch")).rejects.toThrow(
        "Failed to checkout: Branch not found"
      );
    });

    it("should throw error on checkout failure", async () => {
      (git.checkout as jest.Mock).mockRejectedValue(new Error("Uncommitted changes"));

      await expect(service.checkout(mockAppId, "main")).rejects.toThrow(
        "Failed to checkout: Uncommitted changes"
      );
    });
  });

  //
  // -------------------------------------------------------
  // PUSH
  // -------------------------------------------------------
  //
  describe("push()", () => {
    it("should push to remote successfully", async () => {
      (git.push as jest.Mock).mockResolvedValue(undefined);

      await service.push(mockAppId);

      expect(git.push).toHaveBeenCalledWith({
        fs,
        http,
        dir: mockRepoPath,
        remote: "origin",
        ref: "main",
      });
    });

    it("should push to specific remote and ref", async () => {
      (git.push as jest.Mock).mockResolvedValue(undefined);

      await service.push(mockAppId, "upstream", "develop");

      expect(git.push).toHaveBeenCalledWith({
        fs,
        http,
        dir: mockRepoPath,
        remote: "upstream",
        ref: "develop",
      });
    });

    it("should throw error on authentication failure", async () => {
      (git.push as jest.Mock).mockRejectedValue(new Error("Authentication failed"));

      await expect(service.push(mockAppId)).rejects.toThrow(
        "Failed to push: Authentication failed"
      );
    });

    it("should throw error when remote not found", async () => {
      (git.push as jest.Mock).mockRejectedValue(new Error("Remote not found"));

      await expect(service.push(mockAppId, "nonexistent")).rejects.toThrow(
        "Failed to push: Remote not found"
      );
    });

    it("should throw error on push failure", async () => {
      (git.push as jest.Mock).mockRejectedValue(new Error("Network error"));

      await expect(service.push(mockAppId)).rejects.toThrow("Failed to push: Network error");
    });
  });

  //
  // -------------------------------------------------------
  // STATUS
  // -------------------------------------------------------
  //
  describe("status()", () => {
    it("should get repository status successfully", async () => {
      const mockStatus = [
        ["README.md", 1, 2, 2],
        ["src/index.js", 0, 2, 2],
        ["package.json", 1, 0, 2],
      ];

      (git.statusMatrix as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.status(mockAppId);

      expect(git.statusMatrix).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
      });
      expect(result.files).toHaveLength(3);
    });

    it("should mark new files correctly", async () => {
      const mockStatus = [["newfile.js", 0, 2, 2]];

      (git.statusMatrix as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.status(mockAppId);

      expect(result.files[0].status).toBe("new");
    });

    it("should mark modified files correctly", async () => {
      const mockStatus = [["modified.js", 1, 2, 2]];

      (git.statusMatrix as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.status(mockAppId);

      expect(result.files[0].status).toBe("modified");
    });

    it("should mark deleted files correctly", async () => {
      const mockStatus = [["deleted.js", 1, 0, 2]];

      (git.statusMatrix as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.status(mockAppId);

      expect(result.files[0].status).toBe("deleted");
    });

    it("should mark unstaged files correctly", async () => {
      const mockStatus = [["unstaged.js", 1, 2, 0]];

      (git.statusMatrix as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.status(mockAppId);

      expect(result.files[0].status).toBe("unstaged");
    });

    it("should mark unmodified files correctly", async () => {
      const mockStatus = [["unchanged.js", 1, 1, 2]];

      (git.statusMatrix as jest.Mock).mockResolvedValue(mockStatus);

      const result = await service.status(mockAppId);

      expect(result.files[0].status).toBe("unmodified");
    });

    it("should return empty status for clean repository", async () => {
      (git.statusMatrix as jest.Mock).mockResolvedValue([]);

      const result = await service.status(mockAppId);

      expect(result.files).toEqual([]);
    });

    it("should throw error on status failure", async () => {
      (git.statusMatrix as jest.Mock).mockRejectedValue(new Error("Not a git repository"));

      await expect(service.status(mockAppId)).rejects.toThrow(
        "Failed to get status: Not a git repository"
      );
    });
  });

  //
  // -------------------------------------------------------
  // GET CURRENT BRANCH
  // -------------------------------------------------------
  //
  describe("getCurrentBranch()", () => {
    it("should get current branch successfully", async () => {
      (git.currentBranch as jest.Mock).mockResolvedValue("develop");

      const result = await service.getCurrentBranch(mockAppId);

      expect(git.currentBranch).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
      });
      expect(result).toBe("develop");
    });

    it("should return 'main' when current branch is null", async () => {
      (git.currentBranch as jest.Mock).mockResolvedValue(null);

      const result = await service.getCurrentBranch(mockAppId);

      expect(result).toBe("main");
    });

    it("should handle undefined current branch", async () => {
      (git.currentBranch as jest.Mock).mockResolvedValue(undefined);

      const result = await service.getCurrentBranch(mockAppId);

      expect(result).toBe("main");
    });

    it("should throw error on getCurrentBranch failure", async () => {
      (git.currentBranch as jest.Mock).mockRejectedValue(new Error("Not a git repository"));

      await expect(service.getCurrentBranch(mockAppId)).rejects.toThrow(
        "Failed to get current branch: Not a git repository"
      );
    });
  });

  //
  // -------------------------------------------------------
  // LIST BRANCHES
  // -------------------------------------------------------
  //
  describe("listBranches()", () => {
    it("should list all branches successfully", async () => {
      const mockBranches = ["main", "develop", "feature-branch"];

      (git.listBranches as jest.Mock).mockResolvedValue(mockBranches);

      const result = await service.listBranches(mockAppId);

      expect(git.listBranches).toHaveBeenCalledWith({
        fs,
        dir: mockRepoPath,
      });
      expect(result).toEqual(mockBranches);
    });

    it("should return empty array for repository with no branches", async () => {
      (git.listBranches as jest.Mock).mockResolvedValue([]);

      const result = await service.listBranches(mockAppId);

      expect(result).toEqual([]);
    });

    it("should handle multiple branches", async () => {
      const mockBranches = ["main", "develop", "feature/login", "feature/signup", "bugfix/auth"];

      (git.listBranches as jest.Mock).mockResolvedValue(mockBranches);

      const result = await service.listBranches(mockAppId);

      expect(result).toHaveLength(5);
      expect(result).toContain("main");
      expect(result).toContain("develop");
    });

    it("should throw error on listBranches failure", async () => {
      (git.listBranches as jest.Mock).mockRejectedValue(new Error("Not a git repository"));

      await expect(service.listBranches(mockAppId)).rejects.toThrow(
        "Failed to list branches: Not a git repository"
      );
    });
  });
});
