import git from 'isomorphic-git';
import fs from 'node:fs';
import http from 'isomorphic-git/http/node';
import path from 'node:path';
import { AppError } from '../middleware/errorHandler';

/**
 * Git Service - Handles git operations
 * Migrated from src/services/git_service.ts and src/ipc/handlers/github_handlers.ts
 */
export class GitService {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.DATA_DIR || path.join(__dirname, '../../data/apps');
  }

  private getRepoPath(appId: string): string {
    return path.join(this.baseDir, appId);
  }

  async init(appId: string): Promise<void> {
    try {
      const dir = this.getRepoPath(appId);
      await git.init({ fs, dir });
    } catch (error: any) {
      throw new AppError(500, `Failed to initialize git repo: ${error.message}`);
    }
  }

  async clone(appId: string, url: string): Promise<void> {
    try {
      const dir = this.getRepoPath(appId);
      await git.clone({
        fs,
        http,
        dir,
        url,
        singleBranch: true,
        depth: 1,
      });
    } catch (error: any) {
      throw new AppError(500, `Failed to clone repository: ${error.message}`);
    }
  }

  async add(appId: string, filepath: string = '.'): Promise<void> {
    try {
      const dir = this.getRepoPath(appId);
      await git.add({ fs, dir, filepath });
    } catch (error: any) {
      throw new AppError(500, `Failed to add files: ${error.message}`);
    }
  }

  async commit(appId: string, message: string, author?: { name: string; email: string }): Promise<string> {
    try {
      const dir = this.getRepoPath(appId);
      const sha = await git.commit({
        fs,
        dir,
        message,
        author: author || {
          name: 'Dyad',
          email: 'dyad@app.com',
        },
      });
      return sha;
    } catch (error: any) {
      throw new AppError(500, `Failed to commit: ${error.message}`);
    }
  }

  async log(appId: string, depth: number = 10): Promise<any[]> {
    try {
      const dir = this.getRepoPath(appId);
      const commits = await git.log({
        fs,
        dir,
        depth,
      });
      return commits.map(commit => ({
        oid: commit.oid,
        message: commit.commit.message,
        author: commit.commit.author,
        timestamp: commit.commit.author.timestamp,
      }));
    } catch (error: any) {
      throw new AppError(500, `Failed to get commit log: ${error.message}`);
    }
  }

  async checkout(appId: string, ref: string): Promise<void> {
    try {
      const dir = this.getRepoPath(appId);
      await git.checkout({ fs, dir, ref });
    } catch (error: any) {
      throw new AppError(500, `Failed to checkout: ${error.message}`);
    }
  }

  async push(appId: string, remote: string = 'origin', ref: string = 'main'): Promise<void> {
    try {
      const dir = this.getRepoPath(appId);
      await git.push({
        fs,
        http,
        dir,
        remote,
        ref,
      });
    } catch (error: any) {
      throw new AppError(500, `Failed to push: ${error.message}`);
    }
  }

  async status(appId: string): Promise<any> {
    try {
      const dir = this.getRepoPath(appId);
      const status = await git.statusMatrix({ fs, dir });
      
      const files = status.map(([filepath, head, workdir, stage]) => ({
        filepath,
        head,
        workdir,
        stage,
        status: this.getFileStatus(head, workdir, stage),
      }));
      
      return { files };
    } catch (error: any) {
      throw new AppError(500, `Failed to get status: ${error.message}`);
    }
  }

  private getFileStatus(head: number, workdir: number, stage: number): string {
    if (head === 0 && workdir === 2 && stage === 2) return 'new';
    if (head === 1 && workdir === 2 && stage === 2) return 'modified';
    if (head === 1 && workdir === 0 && stage === 2) return 'deleted';
    if (head === 1 && workdir === 2 && stage === 0) return 'unstaged';
    return 'unmodified';
  }

  async getCurrentBranch(appId: string): Promise<string> {
    try {
      const dir = this.getRepoPath(appId);
      const branch = await git.currentBranch({ fs, dir });
      return branch || 'main';
    } catch (error: any) {
      throw new AppError(500, `Failed to get current branch: ${error.message}`);
    }
  }

  async listBranches(appId: string): Promise<string[]> {
    try {
      const dir = this.getRepoPath(appId);
      return await git.listBranches({ fs, dir });
    } catch (error: any) {
      throw new AppError(500, `Failed to list branches: ${error.message}`);
    }
  }
}
