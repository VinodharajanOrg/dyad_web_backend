import request from 'supertest';
import express, { Express } from 'express';
import { GitService } from '../../src/services/git_service';

// Mock the GitService
jest.mock('../../src/services/git_service');

describe('Git Routes', () => {
  let app: Express;
  let mockGitService: any;

  beforeAll(async () => {
    // Setup mock GitService
    mockGitService = {
      init: jest.fn().mockResolvedValue(undefined),
      clone: jest.fn().mockResolvedValue(undefined),
      add: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue('abc123'),
      log: jest.fn().mockResolvedValue([
        { sha: 'abc123', message: 'First commit', author: 'Test User', date: '2025-01-01' },
      ]),
      checkout: jest.fn().mockResolvedValue(undefined),
      push: jest.fn().mockResolvedValue(undefined),
      status: jest.fn().mockResolvedValue({
        branch: 'main',
        ahead: 0,
        behind: 0,
        modified: [],
        untracked: [],
        staged: [],
      }),
      getCurrentBranch: jest.fn().mockResolvedValue('main'),
      listBranches: jest.fn().mockResolvedValue([
        { name: 'main', isActive: true },
        { name: 'develop', isActive: false },
      ]),
    };

    // Mock GitService constructor
    (GitService as jest.MockedClass<typeof GitService>).mockImplementation(() => mockGitService);

    // Setup express app
    app = express();
    app.use(express.json());

    // Import and mount router
    const gitRouter = (await import('../../src/routes/git')).default;
    app.use('/api/git', gitRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-setup mocks after clearing
    (GitService as any).mockImplementation(() => mockGitService);
  });

  //
  // -------------------------------------------------------
  // POST /api/git/:appId/init - Initialize Repository
  // -------------------------------------------------------
  //
  describe('POST /api/git/:appId/init', () => {
    it('should initialize git repository successfully', async () => {
      mockGitService.init.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/git/1/init')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('initialized');
      expect(mockGitService.init).toHaveBeenCalledWith('1');
    });

    it('should handle initialization errors', async () => {
      mockGitService.init.mockRejectedValueOnce(new Error('Init failed'));

      const response = await request(app)
        .post('/api/git/1/init')
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/git/:appId/clone - Clone Repository
  // -------------------------------------------------------
  //
  describe('POST /api/git/:appId/clone', () => {
    it('should clone repository successfully', async () => {
      mockGitService.clone.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/git/1/clone')
        .send({ url: 'https://github.com/user/repo.git' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cloned');
      expect(mockGitService.clone).toHaveBeenCalledWith('1', 'https://github.com/user/repo.git');
    });

    it('should return 400 if url is missing', async () => {
      const response = await request(app)
        .post('/api/git/1/clone')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('url is required');
      expect(mockGitService.clone).not.toHaveBeenCalled();
    });

    it('should handle clone errors', async () => {
      mockGitService.clone.mockRejectedValueOnce(new Error('Clone failed'));

      const response = await request(app)
        .post('/api/git/1/clone')
        .send({ url: 'https://github.com/user/repo.git' })
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/git/:appId/add - Stage Files
  // -------------------------------------------------------
  //
  describe('POST /api/git/:appId/add', () => {
    it('should stage files successfully', async () => {
      mockGitService.add.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/git/1/add')
        .send({ filepath: 'src/App.tsx' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('staged');
      expect(mockGitService.add).toHaveBeenCalledWith('1', 'src/App.tsx');
    });

    it('should stage all files if filepath not provided', async () => {
      mockGitService.add.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/git/1/add')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGitService.add).toHaveBeenCalledWith('1', '.');
    });

    it('should stage specified filepath', async () => {
      mockGitService.add.mockResolvedValueOnce(undefined);

      await request(app)
        .post('/api/git/1/add')
        .send({ filepath: '.' })
        .expect(200);

      expect(mockGitService.add).toHaveBeenCalledWith('1', '.');
    });

    it('should handle add errors', async () => {
      mockGitService.add.mockRejectedValueOnce(new Error('Add failed'));

      const response = await request(app)
        .post('/api/git/1/add')
        .send({})
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/git/:appId/commit - Commit Changes
  // -------------------------------------------------------
  //
  describe('POST /api/git/:appId/commit', () => {
    it('should commit changes successfully', async () => {
      mockGitService.commit.mockResolvedValueOnce('abc123def456');

      const response = await request(app)
        .post('/api/git/1/commit')
        .send({ message: 'Initial commit' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sha).toBe('abc123def456');
      expect(mockGitService.commit).toHaveBeenCalledWith('1', 'Initial commit', undefined);
    });

    it('should commit with custom author', async () => {
      mockGitService.commit.mockResolvedValueOnce('abc123');

      const author = { name: 'John Doe', email: 'john@example.com' };
      const response = await request(app)
        .post('/api/git/1/commit')
        .send({ message: 'Feature commit', author })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGitService.commit).toHaveBeenCalledWith('1', 'Feature commit', author);
    });

    it('should return 400 if message is missing', async () => {
      const response = await request(app)
        .post('/api/git/1/commit')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('message is required');
      expect(mockGitService.commit).not.toHaveBeenCalled();
    });

    it('should handle commit errors', async () => {
      mockGitService.commit.mockRejectedValueOnce(new Error('Commit failed'));

      const response = await request(app)
        .post('/api/git/1/commit')
        .send({ message: 'Test commit' })
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/git/:appId/log - Get Commit Log
  // -------------------------------------------------------
  //
  describe('GET /api/git/:appId/log', () => {
    it('should get commit log successfully', async () => {
      const commits = [
        { sha: 'abc123', message: 'First commit', author: 'Test User', date: '2025-01-01' },
        { sha: 'def456', message: 'Second commit', author: 'Test User', date: '2025-01-02' },
      ];
      mockGitService.log.mockResolvedValueOnce(commits);

      const response = await request(app)
        .get('/api/git/1/log')
        .expect(200);

      expect(response.body.data).toEqual(commits);
      expect(mockGitService.log).toHaveBeenCalledWith('1', 10);
    });

    it('should get log with custom depth', async () => {
      const commits = [{ sha: 'abc123', message: 'First commit' }];
      mockGitService.log.mockResolvedValueOnce(commits);

      const response = await request(app)
        .get('/api/git/1/log?depth=20')
        .expect(200);

      expect(response.body.data).toEqual(commits);
      expect(mockGitService.log).toHaveBeenCalledWith('1', 20);
    });

    it('should use default depth of 10', async () => {
      mockGitService.log.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/git/1/log')
        .expect(200);

      expect(mockGitService.log).toHaveBeenCalledWith('1', 10);
    });

    it('should handle log errors', async () => {
      mockGitService.log.mockRejectedValueOnce(new Error('Log failed'));

      const response = await request(app)
        .get('/api/git/1/log')
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/git/:appId/checkout - Checkout Branch/Commit
  // -------------------------------------------------------
  //
  describe('POST /api/git/:appId/checkout', () => {
    it('should checkout branch successfully', async () => {
      mockGitService.checkout.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/git/1/checkout')
        .send({ ref: 'develop' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('develop');
      expect(mockGitService.checkout).toHaveBeenCalledWith('1', 'develop');
    });

    it('should checkout commit by SHA', async () => {
      mockGitService.checkout.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/git/1/checkout')
        .send({ ref: 'abc123def456' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGitService.checkout).toHaveBeenCalledWith('1', 'abc123def456');
    });

    it('should return 400 if ref is missing', async () => {
      const response = await request(app)
        .post('/api/git/1/checkout')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('ref is required');
      expect(mockGitService.checkout).not.toHaveBeenCalled();
    });

    it('should handle checkout errors', async () => {
      mockGitService.checkout.mockRejectedValueOnce(new Error('Checkout failed'));

      const response = await request(app)
        .post('/api/git/1/checkout')
        .send({ ref: 'nonexistent' })
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/git/:appId/push - Push to Remote
  // -------------------------------------------------------
  //
  describe('POST /api/git/:appId/push', () => {
    it('should push to remote successfully', async () => {
      mockGitService.push.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/git/1/push')
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Pushed');
      expect(mockGitService.push).toHaveBeenCalledWith('1', 'origin', 'main');
    });

    it('should push to custom remote and ref', async () => {
      mockGitService.push.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/git/1/push')
        .send({ remote: 'upstream', ref: 'develop' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockGitService.push).toHaveBeenCalledWith('1', 'upstream', 'develop');
    });

    it('should use default remote and ref if not provided', async () => {
      mockGitService.push.mockResolvedValueOnce(undefined);

      await request(app)
        .post('/api/git/1/push')
        .send({})
        .expect(200);

      expect(mockGitService.push).toHaveBeenCalledWith('1', 'origin', 'main');
    });

    it('should handle push errors', async () => {
      mockGitService.push.mockRejectedValueOnce(new Error('Push failed'));

      const response = await request(app)
        .post('/api/git/1/push')
        .send({})
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/git/:appId/status - Get Repository Status
  // -------------------------------------------------------
  //
  describe('GET /api/git/:appId/status', () => {
    it('should get repository status successfully', async () => {
      const status = {
        branch: 'main',
        ahead: 2,
        behind: 0,
        modified: ['src/App.tsx'],
        untracked: ['src/NewFile.tsx'],
        staged: ['src/App.tsx'],
      };
      mockGitService.status.mockResolvedValueOnce(status);

      const response = await request(app)
        .get('/api/git/1/status')
        .expect(200);

      expect(response.body.data).toEqual(status);
      expect(mockGitService.status).toHaveBeenCalledWith('1');
    });

    it('should show clean status', async () => {
      const status = {
        branch: 'main',
        ahead: 0,
        behind: 0,
        modified: [],
        untracked: [],
        staged: [],
      };
      mockGitService.status.mockResolvedValueOnce(status);

      const response = await request(app)
        .get('/api/git/1/status')
        .expect(200);

      expect(response.body.data.modified).toHaveLength(0);
    });

    it('should handle status errors', async () => {
      mockGitService.status.mockRejectedValueOnce(new Error('Status failed'));

      const response = await request(app)
        .get('/api/git/1/status')
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/git/:appId/branch - Get Current Branch
  // -------------------------------------------------------
  //
  describe('GET /api/git/:appId/branch', () => {
    it('should get current branch successfully', async () => {
      mockGitService.getCurrentBranch.mockResolvedValueOnce('main');

      const response = await request(app)
        .get('/api/git/1/branch')
        .expect(200);

      expect(response.body.data.branch).toBe('main');
      expect(mockGitService.getCurrentBranch).toHaveBeenCalledWith('1');
    });

    it('should return develop branch', async () => {
      mockGitService.getCurrentBranch.mockResolvedValueOnce('develop');

      const response = await request(app)
        .get('/api/git/1/branch')
        .expect(200);

      expect(response.body.data.branch).toBe('develop');
    });

    it('should handle branch errors', async () => {
      mockGitService.getCurrentBranch.mockRejectedValueOnce(new Error('Branch error'));

      const response = await request(app)
        .get('/api/git/1/branch')
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/git/:appId/branches - List Branches
  // -------------------------------------------------------
  //
  describe('GET /api/git/:appId/branches', () => {
    it('should list branches successfully', async () => {
      const branches = [
        { name: 'main', isActive: true },
        { name: 'develop', isActive: false },
        { name: 'feature', isActive: false },
      ];
      mockGitService.listBranches.mockResolvedValueOnce(branches);

      const response = await request(app)
        .get('/api/git/1/branches')
        .expect(200);

      expect(response.body.data).toEqual(branches);
      expect(response.body.data).toHaveLength(3);
      expect(mockGitService.listBranches).toHaveBeenCalledWith('1');
    });

    it('should show active branch', async () => {
      const branches = [
        { name: 'main', isActive: true },
      ];
      mockGitService.listBranches.mockResolvedValueOnce(branches);

      const response = await request(app)
        .get('/api/git/1/branches')
        .expect(200);

      const activeBranch = response.body.data.find((b: any) => b.isActive);
      expect(activeBranch.name).toBe('main');
    });

    it('should handle list branches errors', async () => {
      mockGitService.listBranches.mockRejectedValueOnce(new Error('List failed'));

      const response = await request(app)
        .get('/api/git/1/branches')
        .expect(500);

      expect(response.body).toBeDefined();
    });
  });

  //
  // -------------------------------------------------------
  // Integration Scenarios
  // -------------------------------------------------------
  //
  describe('Integration Scenarios', () => {
    it('should handle complete git workflow', async () => {
      // Initialize repo
      mockGitService.init.mockResolvedValueOnce(undefined);
      let response = await request(app)
        .post('/api/git/1/init')
        .expect(200);
      expect(response.body.success).toBe(true);

      // Check status
      mockGitService.status.mockResolvedValueOnce({
        branch: 'main',
        ahead: 0,
        behind: 0,
        modified: [],
        untracked: [],
        staged: [],
      });
      response = await request(app)
        .get('/api/git/1/status')
        .expect(200);
      expect(response.body.data).toBeDefined();

      // Get current branch
      mockGitService.getCurrentBranch.mockResolvedValueOnce('main');
      response = await request(app)
        .get('/api/git/1/branch')
        .expect(200);
      expect(response.body.data.branch).toBe('main');

      // Stage files
      mockGitService.add.mockResolvedValueOnce(undefined);
      response = await request(app)
        .post('/api/git/1/add')
        .send({})
        .expect(200);
      expect(response.body.success).toBe(true);

      // Commit
      mockGitService.commit.mockResolvedValueOnce('abc123');
      response = await request(app)
        .post('/api/git/1/commit')
        .send({ message: 'Initial commit' })
        .expect(200);
      expect(response.body.data.sha).toBe('abc123');

      // Get log
      mockGitService.log.mockResolvedValueOnce([
        { sha: 'abc123', message: 'Initial commit' },
      ]);
      response = await request(app)
        .get('/api/git/1/log')
        .expect(200);
      expect(response.body.data).toHaveLength(1);

      // Push
      mockGitService.push.mockResolvedValueOnce(undefined);
      response = await request(app)
        .post('/api/git/1/push')
        .send({})
        .expect(200);
      expect(response.body.success).toBe(true);
    });

    it('should handle branch operations', async () => {
      // List branches
      mockGitService.listBranches.mockResolvedValueOnce([
        { name: 'main', isActive: true },
        { name: 'develop', isActive: false },
      ]);
      let response = await request(app)
        .get('/api/git/1/branches')
        .expect(200);
      expect(response.body.data).toHaveLength(2);

      // Checkout branch
      mockGitService.checkout.mockResolvedValueOnce(undefined);
      response = await request(app)
        .post('/api/git/1/checkout')
        .send({ ref: 'develop' })
        .expect(200);
      expect(response.body.success).toBe(true);

      // Verify current branch changed
      mockGitService.getCurrentBranch.mockResolvedValueOnce('develop');
      response = await request(app)
        .get('/api/git/1/branch')
        .expect(200);
      expect(response.body.data.branch).toBe('develop');
    });
  });

  //
  // -------------------------------------------------------
  // Error Handling
  // -------------------------------------------------------
  //
  describe('Error Handling', () => {
    it('should handle invalid appId gracefully', async () => {
      mockGitService.init.mockRejectedValueOnce(new Error('App not found'));

      const response = await request(app)
        .post('/api/git/invalid/init')
        .expect(500);

      expect(response.body).toBeDefined();
    });

    it('should validate required request body fields', async () => {
      const response = await request(app)
        .post('/api/git/1/clone')
        .send({ invalidField: 'value' })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/git/1/commit')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should handle concurrent operations on same app', async () => {
      mockGitService.status.mockResolvedValue({
        branch: 'main',
        ahead: 0,
        behind: 0,
        modified: [],
        untracked: [],
        staged: [],
      });

      const responses = await Promise.all([
        request(app).get('/api/git/1/status'),
        request(app).get('/api/git/1/branch'),
      ]);

      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
    });
  });
});
