import fs from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../middleware/errorHandler';
import { db } from '../db';
import { apps } from '../db/schema';
import { eq } from 'drizzle-orm';
import { shouldIgnorePath } from '../utils/file_ignore';

/**
 * File Service - Handles file system operations
 * Migrated from src/ipc/handlers/app_handlers.ts file operations
 */
export class FileService {
  
  /**
   * Get the app's actual directory path from the database
   */
  private async getAppPath(appId: string): Promise<string> {
    const [app] = await db.select().from(apps).where(eq(apps.id, Number.parseInt(appId)));
    if (!app) {
      throw new AppError(404, `App not found: ${appId}`);
    }
    return app.path;
  }

  private getFullPath(appPath: string, filePath: string = '') {
    // Prevent path traversal attacks
    const normalized = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(appPath, normalized);
  }

  async readFile(appId: string, filePath: string): Promise<string> {
    try {
      const appPath = await this.getAppPath(appId);
      const fullPath = this.getFullPath(appPath, filePath);
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, `File not found: ${filePath}`);
      }
      throw new AppError(500, `Failed to read file: ${error.message}`);
    }
  }

  async writeFile(appId: string, filePath: string, content: string): Promise<void> {
    try {
      const appPath = await this.getAppPath(appId);
      const fullPath = this.getFullPath(appPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    } catch (error: any) {
      throw new AppError(500, `Failed to write file: ${error.message}`);
    }
  }

  async deleteFile(appId: string, filePath: string): Promise<void> {
    try {
      const appPath = await this.getAppPath(appId);
      const fullPath = this.getFullPath(appPath, filePath);
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, `File not found: ${filePath}`);
      }
      throw new AppError(500, `Failed to delete file: ${error.message}`);
    }
  }

  async listFiles(appId: string, dirPath: string = ''): Promise<any[]> {
    try {
      const appPath = await this.getAppPath(appId);
      const fullPath = this.getFullPath(appPath, dirPath);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      
      // Filter out ignored paths
      const filteredEntries = entries.filter(entry => 
        !shouldIgnorePath(entry.name, entry.isDirectory())
      );
      
      return filteredEntries.map(entry => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        path: path.join(dirPath, entry.name),
      }));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, `Directory not found: ${dirPath}`);
      }
      throw new AppError(500, `Failed to list files: ${error.message}`);
    }
  }

  async createDirectory(appId: string, dirPath: string): Promise<void> {
    try {
      const appPath = await this.getAppPath(appId);
      const fullPath = this.getFullPath(appPath, dirPath);
      await fs.mkdir(fullPath, { recursive: true });
    } catch (error: any) {
      throw new AppError(500, `Failed to create directory: ${error.message}`);
    }
  }

  async exists(appId: string, filePath: string): Promise<boolean> {
    try {
      const appPath = await this.getAppPath(appId);
      const fullPath = this.getFullPath(appPath, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(appId: string, filePath: string) {
    try {
      const appPath = await this.getAppPath(appId);
      const fullPath = this.getFullPath(appPath, filePath);
      const stats = await fs.stat(fullPath);
      
      return {
        size: stats.size,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new AppError(404, `File not found: ${filePath}`);
      }
      throw new AppError(500, `Failed to get file stats: ${error.message}`);
    }
  }
}
