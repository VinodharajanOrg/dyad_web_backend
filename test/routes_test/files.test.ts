import request from 'supertest';
import express, { Express } from 'express';

// Mock containerization service singleton and class
const mockContainerService = {
  getContainerStatus: jest.fn().mockResolvedValue({ isRunning: false }),
  syncFilesToContainer: jest.fn().mockResolvedValue({ success: true }),
};

jest.mock('../../src/services/containerization_service', () => ({
  ContainerizationService: {
    getInstance: jest.fn(() => mockContainerService),
  },
  containerizationService: mockContainerService,
}));

// Mock errorHandler middleware
jest.mock('../../src/middleware/errorHandler', () => {
  const errorHandler = (err: any, req: any, res: any, next: any) => {
    if (err.statusCode && err.message) {
      return res.status(err.statusCode).json({
        error: err.message,
      });
    }
    res.status(500).json({
      error: 'Internal server error',
    });
  };

  const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

  class AppError extends Error {
    constructor(public statusCode: number, public message: string) {
      super(message);
    }
  }

  return {
    errorHandler,
    asyncHandler,
    AppError
  };
});

// Mock FileService
jest.mock('../../src/services/file_service');

import { FileService } from '../../src/services/file_service';

describe('Files Routes', () => {
  let app: Express;
  let mockFileService: any;

  beforeAll(async () => {
    // Setup mock FileService
    mockFileService = {
      listFiles: jest.fn(),
      readFile: jest.fn(),
      writeFile: jest.fn(),
      deleteFile: jest.fn(),
      createDirectory: jest.fn(),
      getFileStats: jest.fn(),
    };

    (FileService as any).mockImplementation(() => mockFileService);

    // Setup express app with routes
    app = express();
    app.use(express.json());

    // Import and mount router
    const filesRouter = (await import('../../src/routes/files')).default;
    const { errorHandler } = await import('../../src/middleware/errorHandler');
    
    app.use('/api/files', filesRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-setup mocks after clearing
    (FileService as any).mockImplementation(() => mockFileService);
  });

  //
  // -------------------------------------------------------
  // GET /api/files/:appId - List Files
  // -------------------------------------------------------
  //
  describe('GET /api/files/:appId', () => {
    it('should list files in app directory', async () => {
      const mockFiles = [
        { name: 'src', type: 'directory', path: 'src' },
        { name: 'package.json', type: 'file', path: 'package.json' },
        { name: 'tsconfig.json', type: 'file', path: 'tsconfig.json' },
      ];

      mockFileService.listFiles.mockResolvedValueOnce(mockFiles);

      const response = await request(app)
        .get('/api/files/1')
        .expect(200);

      expect(response.body.data).toEqual(mockFiles);
      expect(mockFileService.listFiles).toHaveBeenCalledWith('1', '');
    });

    it('should list files in subdirectory when path provided', async () => {
      const mockFiles = [
        { name: 'App.tsx', type: 'file', path: 'src/App.tsx' },
        { name: 'index.ts', type: 'file', path: 'src/index.ts' },
      ];

      mockFileService.listFiles.mockResolvedValueOnce(mockFiles);

      const response = await request(app)
        .get('/api/files/1?path=src')
        .expect(200);

      expect(response.body.data).toEqual(mockFiles);
      expect(mockFileService.listFiles).toHaveBeenCalledWith('1', 'src');
    });

    it('should return empty list for empty directory', async () => {
      mockFileService.listFiles.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/files/1?path=empty')
        .expect(200);

      expect(response.body.data).toEqual([]);
    });

    it('should handle errors when listing files', async () => {
      mockFileService.listFiles.mockRejectedValueOnce(new Error('Permission denied'));

      await request(app)
        .get('/api/files/1')
        .expect(500);
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/files/:appId/read - Read File
  // -------------------------------------------------------
  //
  describe('GET /api/files/:appId/read', () => {
    it('should read file content successfully', async () => {
      const fileContent = 'console.log("Hello World")';
      mockFileService.readFile.mockResolvedValueOnce(fileContent);

      const response = await request(app)
        .get('/api/files/1/read?path=src/index.ts')
        .expect(200);

      expect(response.body.data.content).toBe(fileContent);
      expect(mockFileService.readFile).toHaveBeenCalledWith('1', 'src/index.ts');
    });

    it('should return 400 if path query parameter missing', async () => {
      const response = await request(app)
        .get('/api/files/1/read')
        .expect(400);

      expect(response.body.error).toContain('path');
    });

    it('should read file with special characters in path', async () => {
      const fileContent = 'const value = "special/path";';
      mockFileService.readFile.mockResolvedValueOnce(fileContent);

      const response = await request(app)
        .get('/api/files/1/read?path=src/config/special-file.ts')
        .expect(200);

      expect(response.body.data.content).toBe(fileContent);
    });

    it('should handle errors when reading file', async () => {
      mockFileService.readFile.mockRejectedValueOnce(new Error('File not found'));

      await request(app)
        .get('/api/files/1/read?path=nonexistent.ts')
        .expect(500);
    });

    it('should handle empty file content', async () => {
      mockFileService.readFile.mockResolvedValueOnce('');

      const response = await request(app)
        .get('/api/files/1/read?path=empty.txt')
        .expect(200);

      expect(response.body.data.content).toBe('');
    });

    it('should handle large file content', async () => {
      const largeContent = 'x'.repeat(100000);
      mockFileService.readFile.mockResolvedValueOnce(largeContent);

      const response = await request(app)
        .get('/api/files/1/read?path=large.txt')
        .expect(200);

      expect(response.body.data.content.length).toBe(100000);
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/files/:appId/write - Write File
  // -------------------------------------------------------
  //
  describe('POST /api/files/:appId/write', () => {
    it('should write file content successfully', async () => {
      mockFileService.writeFile.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/files/1/write')
        .send({
          path: 'src/App.tsx',
          content: 'export default function App() {}',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockFileService.writeFile).toHaveBeenCalledWith(
        '1',
        'src/App.tsx',
        'export default function App() {}'
      );
    });

    it('should return 400 if path is missing', async () => {
      const response = await request(app)
        .post('/api/files/1/write')
        .send({ content: 'some content' })
        .expect(400);

      expect(response.body.error).toContain('path');
    });

    it('should return 400 if content is missing', async () => {
      const response = await request(app)
        .post('/api/files/1/write')
        .send({ path: 'src/App.tsx' })
        .expect(400);

      expect(response.body.error).toContain('content');
    });

    it('should return 400 if both path and content missing', async () => {
      const response = await request(app)
        .post('/api/files/1/write')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('validation errors');
    });

    it('should write empty content', async () => {
      mockFileService.writeFile.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/files/1/write')
        .send({
          path: 'empty.txt',
          content: '',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockFileService.writeFile).toHaveBeenCalledWith('1', 'empty.txt', '');
    });

    it('should write large file content', async () => {
      const largeContent = 'x'.repeat(100000);
      mockFileService.writeFile.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/files/1/write')
        .send({
          path: 'large.txt',
          content: largeContent,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockFileService.writeFile).toHaveBeenCalledWith('1', 'large.txt', largeContent);
    });

    it('should handle errors when writing file', async () => {
      mockFileService.writeFile.mockRejectedValueOnce(new Error('Permission denied'));

      await request(app)
        .post('/api/files/1/write')
        .send({
          path: 'src/protected.ts',
          content: 'content',
        })
        .expect(500);
    });

    it('should write content with special characters', async () => {
      mockFileService.writeFile.mockResolvedValueOnce(undefined);
      const content = 'const str = "特殊文字";\n// Comment with émojis 🎉';

      const response = await request(app)
        .post('/api/files/1/write')
        .send({
          path: 'special.ts',
          content,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockFileService.writeFile).toHaveBeenCalledWith('1', 'special.ts', content);
    });

    it('should handle 0 as valid content', async () => {
      mockFileService.writeFile.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/files/1/write')
        .send({
          path: 'number.txt',
          content: '0',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  //
  // -------------------------------------------------------
  // DELETE /api/files/:appId - Delete File
  // -------------------------------------------------------
  //
  describe('DELETE /api/files/:appId', () => {
    it('should delete file successfully', async () => {
      mockFileService.deleteFile.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete('/api/files/1?path=src/App.tsx')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockFileService.deleteFile).toHaveBeenCalledWith('1', 'src/App.tsx');
    });

    it('should return 400 if path query parameter missing', async () => {
      const response = await request(app)
        .delete('/api/files/1')
        .expect(400);

      expect(response.body.error).toContain('path');
    });

    it('should delete file with special characters in path', async () => {
      mockFileService.deleteFile.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .delete('/api/files/1?path=src/components/special-component.tsx')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle errors when deleting file', async () => {
      mockFileService.deleteFile.mockRejectedValueOnce(new Error('File not found'));

      await request(app)
        .delete('/api/files/1?path=nonexistent.ts')
        .expect(500);
    });

    it('should handle permission errors when deleting', async () => {
      mockFileService.deleteFile.mockRejectedValueOnce(new Error('Permission denied'));

      await request(app)
        .delete('/api/files/1?path=protected.ts')
        .expect(500);
    });
  });

  //
  // -------------------------------------------------------
  // POST /api/files/:appId/mkdir - Create Directory
  // -------------------------------------------------------
  //
  describe('POST /api/files/:appId/mkdir', () => {
    it('should create directory successfully', async () => {
      mockFileService.createDirectory.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/files/1/mkdir')
        .send({ path: 'src/components' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockFileService.createDirectory).toHaveBeenCalledWith('1', 'src/components');
    });

    it('should return 400 if path is missing', async () => {
      const response = await request(app)
        .post('/api/files/1/mkdir')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('path');
    });

    it('should create nested directories', async () => {
      mockFileService.createDirectory.mockResolvedValueOnce(undefined);

      const response = await request(app)
        .post('/api/files/1/mkdir')
        .send({ path: 'src/components/ui/buttons' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockFileService.createDirectory).toHaveBeenCalledWith(
        '1',
        'src/components/ui/buttons'
      );
    });

    it('should handle errors when creating directory', async () => {
      mockFileService.createDirectory.mockRejectedValueOnce(new Error('Permission denied'));

      await request(app)
        .post('/api/files/1/mkdir')
        .send({ path: 'protected' })
        .expect(500);
    });

    it('should handle existing directory error', async () => {
      mockFileService.createDirectory.mockRejectedValueOnce(new Error('Directory already exists'));

      await request(app)
        .post('/api/files/1/mkdir')
        .send({ path: 'src' })
        .expect(500);
    });
  });

  //
  // -------------------------------------------------------
  // GET /api/files/:appId/stats - Get File Stats
  // -------------------------------------------------------
  //
  describe('GET /api/files/:appId/stats', () => {
    it('should get file stats successfully', async () => {
      const mockStats = {
        size: 1024,
        isFile: true,
        isDirectory: false,
        created: '2025-01-01T00:00:00Z',
        modified: '2025-01-15T10:30:00Z',
      };

      mockFileService.getFileStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/files/1/stats?path=src/App.tsx')
        .expect(200);

      expect(response.body.data).toEqual(mockStats);
      expect(mockFileService.getFileStats).toHaveBeenCalledWith('1', 'src/App.tsx');
    });

    it('should return 400 if path query parameter missing', async () => {
      const response = await request(app)
        .get('/api/files/1/stats')
        .expect(400);

      expect(response.body.error).toContain('path');
    });

    it('should get stats for directory', async () => {
      const mockStats = {
        size: 4096,
        isFile: false,
        isDirectory: true,
        created: '2025-01-01T00:00:00Z',
        modified: '2025-01-15T10:30:00Z',
      };

      mockFileService.getFileStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/files/1/stats?path=src')
        .expect(200);

      expect(response.body.data.isDirectory).toBe(true);
      expect(response.body.data.isFile).toBe(false);
    });

    it('should handle errors when getting stats', async () => {
      mockFileService.getFileStats.mockRejectedValueOnce(new Error('File not found'));

      await request(app)
        .get('/api/files/1/stats?path=nonexistent.ts')
        .expect(500);
    });

    it('should get stats for deeply nested path', async () => {
      const mockStats = {
        size: 512,
        isFile: true,
        isDirectory: false,
        created: '2025-01-01T00:00:00Z',
        modified: '2025-01-15T10:30:00Z',
      };

      mockFileService.getFileStats.mockResolvedValueOnce(mockStats);

      const response = await request(app)
        .get('/api/files/1/stats?path=src/components/ui/buttons/Button.tsx')
        .expect(200);

      expect(response.body.data).toEqual(mockStats);
    });
  });

  //
  // -------------------------------------------------------
  // Integration Scenarios
  // -------------------------------------------------------
  //
  describe('Integration Scenarios', () => {
    it('should handle complete file workflow', async () => {
      // Create directory
      mockFileService.createDirectory.mockResolvedValueOnce(undefined);

      let response = await request(app)
        .post('/api/files/1/mkdir')
        .send({ path: 'src/components' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Write file
      mockFileService.writeFile.mockResolvedValueOnce(undefined);

      response = await request(app)
        .post('/api/files/1/write')
        .send({
          path: 'src/components/Button.tsx',
          content: 'export default function Button() {}',
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Read file
      mockFileService.readFile.mockResolvedValueOnce('export default function Button() {}');

      response = await request(app)
        .get('/api/files/1/read?path=src/components/Button.tsx')
        .expect(200);

      expect(response.body.data.content).toContain('Button');

      // Get stats
      const mockStats = {
        size: 38,
        isFile: true,
        isDirectory: false,
        created: '2025-01-01T00:00:00Z',
        modified: '2025-01-15T10:30:00Z',
      };

      mockFileService.getFileStats.mockResolvedValueOnce(mockStats);

      response = await request(app)
        .get('/api/files/1/stats?path=src/components/Button.tsx')
        .expect(200);

      expect(response.body.data.size).toBe(38);

      // Delete file
      mockFileService.deleteFile.mockResolvedValueOnce(undefined);

      response = await request(app)
        .delete('/api/files/1?path=src/components/Button.tsx')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle multiple file operations on same app', async () => {
      mockFileService.writeFile.mockResolvedValue(undefined);
      mockFileService.readFile.mockResolvedValue('content');

      // Write multiple files
      const files = ['src/App.tsx', 'src/index.ts', 'src/styles.css'];

      for (const file of files) {
        const response = await request(app)
          .post('/api/files/1/write')
          .send({ path: file, content: 'content' })
          .expect(200);

        expect(response.body.success).toBe(true);
      }

      expect(mockFileService.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should handle listing files before and after operations', async () => {
      const initialFiles = [
        { name: 'src', type: 'directory', path: 'src' },
        { name: 'package.json', type: 'file', path: 'package.json' },
      ];

      mockFileService.listFiles.mockResolvedValueOnce(initialFiles);

      let response = await request(app)
        .get('/api/files/1')
        .expect(200);

      expect(response.body.data).toHaveLength(2);

      // Create a file
      mockFileService.writeFile.mockResolvedValueOnce(undefined);

      await request(app)
        .post('/api/files/1/write')
        .send({ path: 'README.md', content: '# My App' })
        .expect(200);

      // List again
      const updatedFiles = [
        { name: 'src', type: 'directory', path: 'src' },
        { name: 'package.json', type: 'file', path: 'package.json' },
        { name: 'README.md', type: 'file', path: 'README.md' },
      ];

      mockFileService.listFiles.mockResolvedValueOnce(updatedFiles);

      response = await request(app)
        .get('/api/files/1')
        .expect(200);

      expect(response.body.data).toHaveLength(3);
    });
  });

  //
  // -------------------------------------------------------
  // Edge Cases and Error Handling
  // -------------------------------------------------------
  //
  describe('Edge Cases and Error Handling', () => {
    it('should handle path with trailing slash', async () => {
      const mockFiles = [{ name: 'file.ts', type: 'file', path: 'src/file.ts' }];
      mockFileService.listFiles.mockResolvedValueOnce(mockFiles);

      const response = await request(app)
        .get('/api/files/1?path=src/')
        .expect(200);

      expect(response.body.data).toEqual(mockFiles);
    });

    it('should handle app IDs with special characters', async () => {
      const mockFiles = [{ name: 'file.ts', type: 'file' }];
      mockFileService.listFiles.mockResolvedValueOnce(mockFiles);

      const response = await request(app)
        .get('/api/files/app-123')
        .expect(200);

      expect(response.body.data).toEqual(mockFiles);
      expect(mockFileService.listFiles).toHaveBeenCalledWith('app-123', '');
    });

    it('should handle numeric app IDs', async () => {
      const mockFiles = [{ name: 'file.ts', type: 'file' }];
      mockFileService.listFiles.mockResolvedValueOnce(mockFiles);

      const response = await request(app)
        .get('/api/files/12345')
        .expect(200);

      expect(response.body.data).toEqual(mockFiles);
    });

    it('should handle rapid successive requests', async () => {
      mockFileService.readFile.mockResolvedValue('content1');
      mockFileService.writeFile.mockResolvedValue(undefined);

      // Make multiple rapid requests
      const promises = [
        request(app).get('/api/files/1/read?path=file1.ts'),
        request(app).get('/api/files/1/read?path=file2.ts'),
        request(app).post('/api/files/1/write').send({ path: 'file3.ts', content: 'new' }),
      ];

      const responses = await Promise.all(promises);

      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(200);
      expect(responses[2].status).toBe(200);
    });
  });
});
