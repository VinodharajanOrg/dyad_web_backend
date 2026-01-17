import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { filesApi, FileInfo, FileStats } from '../endpoints/files';
import * as apiClientModule from '../client';

vi.mock('../client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('filesApi - Complete Test Suite', () => {
  const mockApiClient = apiClientModule.apiClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readFile()', () => {
    it('should read file content', async () => {
      const mockContent = 'console.log("hello");';

      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ content: mockContent });

      const result = await filesApi.readFile(1, '/src/index.ts');

      expect(mockApiClient.get).toHaveBeenCalledWith('/files/1/read', {
        params: { path: '/src/index.ts' },
      });
      expect(result).toBe(mockContent);
    });

    it('should handle empty files', async () => {
      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ content: '' });

      const result = await filesApi.readFile(1, '/empty.txt');

      expect(result).toBe('');
    });
  });

  describe('writeFile()', () => {
    it('should write file content', async () => {
      const content = 'const x = 1;';

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      const result = await filesApi.writeFile(1, '/src/app.ts', content);

      expect(mockApiClient.post).toHaveBeenCalledWith('/files/1/write', {
        path: '/src/app.ts',
        content,
      });
      expect(result).toEqual({});
    });

    it('should return warnings for syntax issues', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({
        warning: 'Unused variable detected',
      });

      const result = await filesApi.writeFile(1, '/src/bad.ts', 'let x;');

      expect(result.warning).toBe('Unused variable detected');
    });
  });

  describe('deleteFile()', () => {
    it('should delete a file', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({});

      await filesApi.deleteFile(1, '/src/old.ts');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/files/1', {
        params: { path: '/src/old.ts' },
      });
    });
  });

  describe('listFiles()', () => {
    it('should list files in root directory', async () => {
      const mockFiles: FileInfo[] = [
        { name: 'src', isDirectory: true, path: '/src' },
        { name: 'package.json', isDirectory: false, path: '/package.json' },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockFiles);

      const result = await filesApi.listFiles(1);

      expect(mockApiClient.get).toHaveBeenCalledWith('/files/1', {
        params: { path: '' },
      });
      expect(result).toEqual(mockFiles);
    });

    it('should list files in subdirectory', async () => {
      const mockFiles: FileInfo[] = [
        { name: 'index.ts', isDirectory: false, path: '/src/index.ts' },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockFiles);

      const result = await filesApi.listFiles(1, '/src');

      expect(mockApiClient.get).toHaveBeenCalledWith('/files/1', {
        params: { path: '/src' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getFileStats()', () => {
    it('should get file statistics', async () => {
      const mockStats: FileStats = {
        size: 1024,
        isDirectory: false,
        isFile: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockStats);

      const result = await filesApi.getFileStats(1, '/src/index.ts');

      expect(mockApiClient.get).toHaveBeenCalledWith('/files/1/stats', {
        params: { path: '/src/index.ts' },
      });
      expect(result.size).toBe(1024);
    });

    it('should handle stats for directory', async () => {
      const mockStats: FileStats = {
        size: 0,
        isDirectory: true,
        isFile: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockStats);

      const result = await filesApi.getFileStats(1, '/src');

      expect(result.isDirectory).toBe(true);
      expect(result.isFile).toBe(false);
    });

    it('should handle stats error', async () => {
      const error = new Error('File not found');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      await expect(filesApi.getFileStats(1, '/missing.ts')).rejects.toThrow('File not found');
    });
  });

  describe('createDirectory()', () => {
    it('should create a new directory', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await filesApi.createDirectory(1, '/new-folder');

      expect(mockApiClient.post).toHaveBeenCalledWith('/files/1/mkdir', {
        path: '/new-folder',
      });
    });

    it('should handle directory creation error', async () => {
      const error = new Error('Directory already exists');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(filesApi.createDirectory(1, '/existing')).rejects.toThrow('Directory already exists');
    });

    it('should create nested directories', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await filesApi.createDirectory(1, '/src/components/ui');

      expect(mockApiClient.post).toHaveBeenCalledWith('/files/1/mkdir', {
        path: '/src/components/ui',
      });
    });
  });

  describe('readFile() - Extended', () => {
    it('should read large files', async () => {
      const largeContent = 'x'.repeat(10000);

      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ content: largeContent });

      const result = await filesApi.readFile(1, '/large.txt');

      expect(result).toHaveLength(10000);
    });

    it('should read files with special characters', async () => {
      const content = 'console.log("Hello\\nWorld\\t!");';

      vi.mocked(mockApiClient.get).mockResolvedValueOnce({ content });

      const result = await filesApi.readFile(1, '/special.ts');

      expect(result).toContain('\\n');
    });

    it('should handle read error', async () => {
      const error = new Error('Permission denied');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      await expect(filesApi.readFile(1, '/restricted.ts')).rejects.toThrow('Permission denied');
    });
  });

  describe('writeFile() - Extended', () => {
    it('should write large files', async () => {
      const largeContent = 'x'.repeat(50000);

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await filesApi.writeFile(1, '/large.txt', largeContent);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/files/1/write',
        expect.objectContaining({ content: largeContent })
      );
    });

    it('should handle write error', async () => {
      const error = new Error('Disk full');

      vi.mocked(mockApiClient.post).mockRejectedValueOnce(error);

      await expect(filesApi.writeFile(1, '/app.ts', 'code')).rejects.toThrow('Disk full');
    });

    it('should write with warnings', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({
        warning: 'Line too long',
      });

      const result = await filesApi.writeFile(1, '/long-line.ts', 'x'.repeat(500));

      expect(result.warning).toContain('Line too long');
    });

    it('should write empty content', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      await filesApi.writeFile(1, '/blank.txt', '');

      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/files/1/write',
        expect.objectContaining({ content: '' })
      );
    });
  });

  describe('deleteFile() - Extended', () => {
    it('should handle delete error', async () => {
      const error = new Error('File not found');

      vi.mocked(mockApiClient.delete).mockRejectedValueOnce(error);

      await expect(filesApi.deleteFile(1, '/missing.ts')).rejects.toThrow('File not found');
    });

    it('should delete with different app IDs', async () => {
      vi.mocked(mockApiClient.delete).mockResolvedValueOnce({});

      await filesApi.deleteFile(42, '/file.ts');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/files/42', {
        params: { path: '/file.ts' },
      });
    });
  });

  describe('listFiles() - Extended', () => {
    it('should handle list error', async () => {
      const error = new Error('Directory not found');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      await expect(filesApi.listFiles(1, '/missing')).rejects.toThrow('Directory not found');
    });

    it('should handle empty directory', async () => {
      vi.mocked(mockApiClient.get).mockResolvedValueOnce([]);

      const result = await filesApi.listFiles(1, '/empty');

      expect(result).toHaveLength(0);
    });

    it('should list mixed files and directories', async () => {
      const mockFiles: FileInfo[] = [
        { name: 'src', isDirectory: true, path: '/src' },
        { name: 'dist', isDirectory: true, path: '/dist' },
        { name: 'package.json', isDirectory: false, path: '/package.json' },
        { name: 'README.md', isDirectory: false, path: '/README.md' },
      ];

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockFiles);

      const result = await filesApi.listFiles(1);

      expect(result).toHaveLength(4);
      expect(result.filter(f => f.isDirectory)).toHaveLength(2);
    });
  });

  describe('exists()', () => {
    it('should return true if file exists', async () => {
      const mockStats: FileStats = {
        size: 100,
        isDirectory: false,
        isFile: true,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockStats);

      const result = await filesApi.exists(1, '/exists.ts');

      expect(result).toBe(true);
      expect(mockApiClient.get).toHaveBeenCalled();
    });

    it('should return false if file does not exist', async () => {
      const error = new Error('File not found');

      vi.mocked(mockApiClient.get).mockRejectedValueOnce(error);

      const result = await filesApi.exists(1, '/missing.ts');

      expect(result).toBe(false);
    });

    it('should check directory existence', async () => {
      const mockStats: FileStats = {
        size: 0,
        isDirectory: true,
        isFile: false,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };

      vi.mocked(mockApiClient.get).mockResolvedValueOnce(mockStats);

      const result = await filesApi.exists(1, '/src');

      expect(result).toBe(true);
    });
  });

  describe('Integration scenarios', () => {
    it('should create directory then list files', async () => {
      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      vi.mocked(mockApiClient.get).mockResolvedValueOnce([
        { name: 'newfile.ts', isDirectory: false, path: '/newdir/newfile.ts' },
      ]);

      await filesApi.createDirectory(1, '/newdir');
      const files = await filesApi.listFiles(1, '/newdir');

      expect(files).toHaveLength(1);
    });

    it('should read → write → check existence', async () => {
      const originalContent = 'const x = 1;';
      const newContent = 'const x = 2;';

      vi.mocked(mockApiClient.get)
        .mockResolvedValueOnce({ content: originalContent })
        .mockResolvedValueOnce({
          size: newContent.length,
          isDirectory: false,
          isFile: true,
          createdAt: new Date(),
          modifiedAt: new Date(),
        });

      vi.mocked(mockApiClient.post).mockResolvedValueOnce({});

      const read = await filesApi.readFile(1, '/app.ts');
      expect(read).toBe(originalContent);

      await filesApi.writeFile(1, '/app.ts', newContent);

      const exists = await filesApi.exists(1, '/app.ts');
      expect(exists).toBe(true);
    });
  });
});
