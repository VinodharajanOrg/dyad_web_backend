import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  gitApi,
  BranchResult,
  GitBranch,
  GitCommit,
  GitStatus,
  CheckoutParams,
  RenameBranchParams,
} from '../endpoints/git';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('gitApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrentBranch()', () => {
    it('should get current branch', async () => {
      const mockResult: BranchResult = {
        branch: 'main',
        hasGit: true,
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockResult);

      const result = await gitApi.getCurrentBranch(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/git/1/branch');
      expect(result.branch).toBe('main');
      expect(result.hasGit).toBe(true);
    });

    it('should handle no git repository', async () => {
      const mockResult: BranchResult = {
        branch: null,
        hasGit: false,
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockResult);

      const result = await gitApi.getCurrentBranch(1);

      expect(result.hasGit).toBe(false);
      expect(result.branch).toBeNull();
    });
  });

  describe('listBranches()', () => {
    it('should list all branches', async () => {
      const mockBranches: GitBranch[] = [
        { name: 'main', commit: { sha: 'abc123' } },
        { name: 'develop', commit: { sha: 'def456' } },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockBranches);

      const result = await gitApi.listBranches(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/git/1/branches');
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('main');
    });
  });

  describe('getCommitLog()', () => {
    it('should get commit history', async () => {
      const mockCommits: GitCommit[] = [
        {
          hash: 'abc123',
          message: 'Initial commit',
          author: 'John Doe',
          date: '2025-01-01',
        },
        {
          hash: 'def456',
          message: 'Add feature',
          author: 'Jane Doe',
          date: '2025-01-02',
        },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockCommits);

      const result = await gitApi.getCommitLog(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/git/1/log');
      expect(result).toHaveLength(2);
      expect(result[0].author).toBe('John Doe');
    });
  });

  describe('checkout()', () => {
    it('should checkout a branch or commit', async () => {
      const params: CheckoutParams = {
        appId: 1,
        versionId: 'main',
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.checkout(params);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/git/1/checkout',
        { ref: 'main' }
      );
    });

    it('should checkout a specific commit', async () => {
      const params: CheckoutParams = {
        appId: 1,
        versionId: 'abc123def456',
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.checkout(params);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/git/1/checkout',
        { ref: 'abc123def456' }
      );
    });
  });

  describe('getStatus()', () => {
    it('should get repository status', async () => {
      const mockStatus: GitStatus = {
        branch: 'main',
        ahead: 2,
        behind: 1,
        modified: ['file1.ts', 'file2.ts'],
        added: ['file3.ts'],
        deleted: [],
        untracked: ['node_modules/'],
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockStatus);

      const result = await gitApi.getStatus(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/git/1/status');
      expect(result.branch).toBe('main');
      expect(result.modified).toHaveLength(2);
    });
  });

  describe('init()', () => {
    it('should initialize git repository', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.init(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/git/1/init');
    });
  });

  describe('add()', () => {
    it('should stage files for commit', async () => {
      const files = ['src/index.ts', 'src/app.ts'];

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.add(1, files);

      expect(mockApiClient.post).toHaveBeenCalledWith('/git/1/add', { files });
    });
  });

  describe('commit()', () => {
    it('should commit staged changes', async () => {
      const message = 'Add new feature';

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.commit(1, message);

      expect(mockApiClient.post).toHaveBeenCalledWith('/git/1/commit', { message });
    });
  });

  describe('push()', () => {
    it('should push to remote repository', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.push(1);

      expect(mockApiClient.post).toHaveBeenCalledWith('/git/1/push', {
        remote: undefined,
        branch: undefined,
      });
    });

    it('should push to specific remote and branch', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.push(1, 'origin', 'main');

      expect(mockApiClient.post).toHaveBeenCalledWith('/git/1/push', {
        remote: 'origin',
        branch: 'main',
      });
    });
  });

  describe('clone()', () => {
    it('should clone a repository', async () => {
      const url = 'https://github.com/dyad-sh/dyad.git';

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.clone(1, url);

      expect(mockApiClient.post).toHaveBeenCalledWith('/git/1/clone', {
        url,
        path: undefined,
      });
    });

    it('should clone to specific path', async () => {
      const url = 'https://github.com/dyad-sh/dyad.git';
      const path = '/app/repo';

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.clone(1, url, path);

      expect(mockApiClient.post).toHaveBeenCalledWith('/git/1/clone', {
        url,
        path,
      });
    });
  });

  describe('renameBranch()', () => {
    it('should rename a branch', async () => {
      const params: RenameBranchParams = {
        appId: 1,
        oldBranchName: 'old-name',
        newBranchName: 'new-name',
      };

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await gitApi.renameBranch(params);

      expect(mockApiClient.post).toHaveBeenCalledWith('/git/1/rename-branch', {
        oldName: 'old-name',
        newName: 'new-name',
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should init → add → commit → push', async () => {
      vi.mocked(mockApiClient.post)
        .mockResolvedValueOnce({}) // init
        .mockResolvedValueOnce({}) // add
        .mockResolvedValueOnce({}) // commit
        .mockResolvedValueOnce({}); // push

      await gitApi.init(1);
      await gitApi.add(1, ['file.ts']);
      await gitApi.commit(1, 'Initial commit');
      await gitApi.push(1, 'origin', 'main');

      expect(mockApiClient.post).toHaveBeenCalledTimes(4);
    });

    it('should get status → checkout → get status', async () => {
      const status1: GitStatus = {
        branch: 'main',
        ahead: 0,
        behind: 0,
        modified: [],
        added: [],
        deleted: [],
        untracked: [],
      };

      const status2: GitStatus = {
        branch: 'develop',
        ahead: 1,
        behind: 2,
        modified: ['app.ts'],
        added: [],
        deleted: [],
        untracked: [],
      };

      vi.mocked(mockApiClient.get)
        .mockResolvedValueOnce(status1)
        .mockResolvedValueOnce(status2);

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      const stat1 = await gitApi.getStatus(1);
      expect(stat1.branch).toBe('main');

      await gitApi.checkout({ appId: 1, versionId: 'develop' });

      const stat2 = await gitApi.getStatus(1);
      expect(stat2.branch).toBe('develop');
      expect(stat2.modified).toHaveLength(1);
    });
  });
});
