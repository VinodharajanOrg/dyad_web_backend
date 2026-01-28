import git from 'isomorphic-git';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import http from 'isomorphic-git/http/node';
import path from 'node:path';
import { AppError } from '../middleware/errorHandler';
import { db } from '../db';
import { apps, gitIntegrations } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { encryptGitToken, decryptGitToken } from '../utils/gitTokenCrypto';
import { AppService } from './app_service';
import { logger } from '../utils/logger';

type GithubRepoApiResponse = {
  name: string;
  default_branch: string;
  private: boolean;
  visibility?: 'public' | 'private' | 'internal';
  owner: {
    login: string;
  };
};

// Create fs object for isomorphic-git with all required async methods
// isomorphic-git requires a complete fs interface
const fsForGit = {
  // Async methods from fs/promises - must include all methods isomorphic-git might use
  readFile: fs.readFile.bind(fs),
  writeFile: fs.writeFile.bind(fs),
  readdir: fs.readdir.bind(fs),
  mkdir: fs.mkdir.bind(fs),
  rmdir: fs.rmdir.bind(fs),
  rm: fs.rm.bind(fs),
  unlink: fs.unlink.bind(fs),
  stat: fs.stat.bind(fs),
  lstat: fs.lstat.bind(fs),
  readlink: fs.readlink.bind(fs),
  symlink: fs.symlink.bind(fs),
  chmod: fs.chmod.bind(fs),
  copyFile: fs.copyFile.bind(fs),
  truncate: fs.truncate.bind(fs),
};

/**
 * Git Service - Handles git operations
 * Migrated from src/services/git_service.ts and src/ipc/handlers/github_handlers.ts
 */
export class GitService {
  private readonly baseDir: string;
  private readonly appService: AppService;

  constructor() {
    // Use the same base directory as AppService for consistency
    // APPS_BASE_DIR is set in .env, defaults to ./apps
    this.baseDir = process.env.APPS_BASE_DIR || process.env.DATA_DIR || path.join(__dirname, '../../data/apps');
    this.appService = new AppService();
  }

  /**
   * Get the actual app directory path from the database
   * Returns the absolute path by resolving relative paths from the database
   */
  private async getRepoPath(appId: string): Promise<string> {
    try {
      const appIdNum = Number.parseInt(appId);
      const [app] = await db.select().from(apps).where(eq(apps.id, appIdNum));
      
      if (!app) {
        // Fallback to appId-based path if app not found
        logger.warn('App not found in database, falling back to numeric path', { service: 'git', appId });
        return path.join(this.baseDir, appId);
      }
      
      // CRITICAL FIX: Resolve relative paths to absolute paths using AppService
      return this.appService.getFullAppPath(app.path);
    } catch (error: any) {
      logger.error('Error fetching app path', error, { service: 'git', appId });
      // Fallback to appId-based path
      return path.join(this.baseDir, appId);
    }
  }

  async init(appId: string): Promise<void> {
    try {
      const dir = await this.getRepoPath(appId);
      await git.init({ fs: fsForGit, dir });
    } catch (error: any) {
      throw new AppError(500, `Failed to initialize git repo: ${error.message}`);
    }
  }

  async clone(appId: string, url: string): Promise<void> {
    try {
      const dir = await this.getRepoPath(appId);
      await git.clone({
        fs: fsForGit,
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

  async add(appId: string): Promise<void> {
  try {
    const dir = await this.getRepoPath(appId);

    const status = await git.statusMatrix({
      fs: fsForGit,
      dir,
    });

    for (const [filepath, head, workdir, stage] of status) {
      // If file is new, modified, or deleted
      if (workdir !== stage) {
        logger.info('Staging file', { service: 'git', filepath });

        await git.add({
          fs: fsForGit,
          dir,
          filepath,
        });
      }
    }

    logger.info('All changes staged', { service: 'git', appId });
  } catch (error: any) {
    logger.error('Failed to add files', error, { service: 'git', appId });
    throw new AppError(500, `Failed to add files: ${error.message}`);
  }
}


  // async add(appId: string, filepath: string = '.'): Promise<void> {
  //   try {
  //     const dir = await this.getRepoPath(appId);
      
  //     // List files before add for diagnostics
  //     const filesBefore = await fs.readdir(dir, { recursive: false }).catch(() => []);
  //     console.log(`[GitService.add] Files in ${dir} BEFORE git.add:`, filesBefore);
      
  //     const srcBefore = await fs.readdir(path.join(dir, 'src'), { recursive: true }).catch(() => []);
  //     console.log(`[GitService.add] src/ files BEFORE git.add (recursively):`, srcBefore.slice(0, 5));
      
  //     console.log(`[GitService.add] Calling git.add with dir=${dir}, filepath=${filepath}`);
      
  //     await git.add({ fs: fsForGit, dir, filepath });
      
  //     // List files after add
  //     const filesAfter = await fs.readdir(dir, { recursive: false }).catch(() => []);
  //     console.log(`[GitService.add] Files in ${dir} AFTER git.add:`, filesAfter);
      
  //     console.log(`[GitService.add] Successfully added files for appId=${appId}`);
  //   } catch (error: any) {
  //     console.error(`[GitService.add] FAILED for appId=${appId}:`, error);
  //     throw new AppError(500, `Failed to add files: ${error.message}`);
  //   }
  // }

  async commit(appId: string, message: string, author?: { name: string; email: string }): Promise<string> {
    try {
      const dir = await this.getRepoPath(appId);
      
      logger.info('Starting commit', { service: 'git', appId, message });
      
      // Check the index
      try {
        const status = await git.statusMatrix({ fs: fsForGit, dir });
        logger.debug('Git status matrix (staged changes)', { service: 'git', appId, statusCount: status.slice(0, 10).length });
      } catch (e) {
        logger.debug('Could not get status matrix', { service: 'git', appId, error: (e as any).message });
      }
      
      const sha = await git.commit({
        fs: fsForGit,
        dir,
        message,
        author: author || {
          name: 'Dyad',
          email: 'dyad@app.com',
        },
      });
      
      logger.info('Commit successful', { service: 'git', appId, sha });
      
      return sha;
    } catch (error: any) {
      logger.error('Commit failed', error, { service: 'git', appId });
      throw new AppError(500, `Failed to commit: ${error.message}`);
    }
  }

  async log(appId: string, depth: number = 10): Promise<any[]> {
    try {
      const dir = await this.getRepoPath(appId);
      
      logger.debug('Starting log', { service: 'git', appId, dir });
      
      // Check if .git directory exists
      const gitDir = path.join(dir, '.git');
      if (!fsSync.existsSync(gitDir)) {
        // Repository not initialized yet, return empty list
        logger.debug('No .git directory found, returning empty list', { service: 'git', appId, gitDir });
        return [];
      }
      
      let commits: any[] = [];
      
      // Try to log from 'main' branch first (most common default branch)
      // This ensures we get ALL commits even if we're in a detached HEAD state
      // Use fsForGit which has both sync and async fs methods
      try {
        logger.debug('Trying to get commits from main branch', { service: 'git', appId });
        commits = await git.log({
          fs: fsForGit,
          dir,
          ref: 'main',
          depth,
        });
        logger.debug('Got commits from main', { service: 'git', appId, count: commits.length });
      } catch (e) {
        // If 'main' doesn't exist, try 'master' (older git convention)
        logger.debug('main branch not found, trying master', { service: 'git', appId });
        try {
          commits = await git.log({
            fs: fsForGit,
            dir,
            ref: 'master',
            depth,
          });
          logger.debug('Got commits from master', { service: 'git', appId, count: commits.length });
        } catch (e2) {
          // If neither branch exists, fall back to current HEAD
          // This handles the case of first commit (before branches exist)
          logger.debug('master branch not found, trying HEAD', { service: 'git', appId });
          commits = await git.log({
            fs: fsForGit,
            dir,
            depth,
          });
          logger.debug('Got commits from HEAD', { service: 'git', appId, count: commits.length });
        }
      }
      
      const result = commits.map(commit => ({
        oid: commit.oid,
        message: commit.commit.message,
        author: commit.commit.author,
        timestamp: commit.commit.author.timestamp,
      }));
      
      logger.debug('Returning formatted commits', { service: 'git', appId, count: result.length });
      
      return result;
    } catch (error: any) {
      // Log the error but return empty array for non-critical failures
      logger.error('Error getting commits', error, { service: 'git', appId });
      // Return empty array instead of throwing to allow UI to show "No versions"
      return [];
    }
  }

  async checkout(appId: string, ref: string): Promise<void> {
    try {
      const dir = await this.getRepoPath(appId);
      logger.info('Starting checkout', { service: 'git', appId, ref, dir });
      
      // Verify git repo exists
      const gitDir = path.join(dir, '.git');
      if (!fsSync.existsSync(gitDir)) {
        throw new Error(`Git repository not found at ${gitDir}`);
      }
      logger.debug('Git repo confirmed', { service: 'git', appId, gitDir });
      
      // List ALL files in working directory to see what we're working with
      const allFiles = await fs.readdir(dir, { recursive: false }).catch(() => []);
      logger.debug('Directory structure', { service: 'git', appId, fileCount: allFiles.length });
      
      // Get files before checkout for diagnostics
      const srcDir = path.join(dir, 'src');
      const before = await fs.readdir(srcDir).catch(() => []);
      logger.debug('Files in src/ before checkout', { service: 'git', appId, count: before.slice(0, 5).length });

      // Check what branches exist
      try {
        const branches = await git.listBranches({ fs: fsForGit, dir });
        logger.debug('Available branches', { service: 'git', appId, branches });
      } catch (e) {
        logger.debug('Could not list branches', { service: 'git', appId, error: (e as any).message });
      }

      // Check if the ref exists as a commit
      try {
        const resolvedRef = await git.resolveRef({ fs: fsForGit, dir, ref });
        logger.debug('Resolved ref to commit', { service: 'git', appId, ref, resolvedRef });
      } catch (e) {
        logger.debug('Could not resolve ref', { service: 'git', appId, ref, error: (e as any).message });
      }

      // ref can be a commit hash (oid) or branch name
      // Use force: true to allow checking out to detached HEAD state
      // Pass fsForGit which has both sync and async fs methods
      logger.debug('About to call git.checkout', { service: 'git', appId, ref });
      
      const result = await git.checkout({ 
        fs: fsForGit, 
        dir, 
        ref,
        force: true,  // Allow checkout even if working directory has changes
      });

      // Get files after checkout to verify they changed
      const after = await fs.readdir(srcDir).catch(() => []);
      logger.debug('Files in src/ after checkout', { service: 'git', appId, count: after.slice(0, 5).length });
      
      // List all files again after checkout
      const allFilesAfter = await fs.readdir(dir, { recursive: false }).catch(() => []);
      logger.debug('Directory structure after checkout', { service: 'git', appId, fileCount: allFilesAfter.length });
      
      logger.info('Checkout successful', { service: 'git', appId, ref });
    } catch (error: any) {
      logger.error('Checkout failed', error, { service: 'git', appId, ref });
      throw new AppError(500, `Failed to checkout ${ref}: ${error.message}`);
    }
  }

  async push(appId: string,userId: string, remote: string = 'origin', ref: string = 'main'): Promise<void> {
    try {
      const dir = await this.getRepoPath(appId);
      const token = await this.getGithubAccessToken(userId);
      await git.push({
        fs: fsForGit,
        http,
        dir,
        remote,
        ref,
        onAuth: () => ({
        username: 'x-access-token',
        password: token,
    }),
      });
    } catch (error: any) {
      throw new AppError(500, `Failed to push: ${error.message}`);
    }
  }

  async status(appId: string): Promise<any> {
    try {
      const dir = await this.getRepoPath(appId);
      const status = await git.statusMatrix({ fs: fsForGit, dir });
      
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
      const dir = await this.getRepoPath(appId);
      const branch = await git.currentBranch({ fs: fsForGit, dir });
      return branch || 'main';
    } catch (error: any) {
      throw new AppError(500, `Failed to get current branch: ${error.message}`);
    }
  }

  /**
   * Stage changes to revert to a target commit state
   * Directly extracts the entire tree from the target commit to ensure perfect reversion
   */
  private async stageToRevert(dir: string, targetOid: string): Promise<void> {
    logger.info('Starting stageToRevert', { service: 'git', targetOid });

    try {
      // First, collect all current files so we can delete ones not in target
      const currentFiles = new Set<string>();
      const walkCurrentDir = async (dirPath: string, relPath: string = '') => {
        try {
          const entries = await fs.readdir(dirPath);
          for (const entry of entries) {
            if (entry === '.git') continue;
            
            const fullPath = path.join(dirPath, entry);
            const gitPath = relPath ? `${relPath}/${entry}` : entry;
            const stat = await fs.stat(fullPath);
            
            if (stat.isDirectory()) {
              await walkCurrentDir(fullPath, gitPath);
            } else {
              currentFiles.add(gitPath);
            }
          }
        } catch (e) {
          logger.debug('Error walking directory', { service: 'git', dirPath, error: String(e) });
        }
      };

      await walkCurrentDir(dir);
      logger.debug('Found current files in working directory', { service: 'git', count: currentFiles.size });

      // Get all files from the target commit
      const targetFiles = new Set<string>();
      
      // Read the target commit
      const targetCommit = await git.readObject({
        fs: fsForGit,
        dir,
        oid: targetOid,
      });

      if (!targetCommit.object) {
        throw new Error(`Could not read target commit ${targetOid}`);
      }

      const treeOid = (targetCommit.object as any).tree;
      if (!treeOid) {
        throw new Error(`Target commit ${targetOid} has no tree`);
      }

      logger.debug('Target tree OID', { service: 'git', treeOid });

      // Walk the target tree to get all files
      const walkTargetTree = async (treeOidToWalk: string, pathPrefix: string = '') => {
        try {
          const treeObj = await git.readObject({
            fs: fsForGit,
            dir,
            oid: treeOidToWalk,
          });

          if (!treeObj.object || typeof treeObj.object === 'string') {
            logger.debug('Tree object is invalid', { service: 'git' });
            return;
          }

          const treeData = treeObj.object as any;
          
          // Debug: log the structure
          logger.debug('Tree data keys', { service: 'git', keys: Object.keys(treeData).join(', ') });
          logger.debug('treeData.entries type', { service: 'git', type: typeof treeData.entries });
          
          // isomorphic-git returns tree entries as numeric-indexed array-like object
          // Get all values from the object (which are the tree entries)
          const entries: any[] = Object.values(treeData).filter((entry: any) => {
            return entry && typeof entry === 'object' && (entry.path || entry.oid);
          });
          
          if (entries.length === 0) {
            logger.debug('Tree has no entries after filtering', { service: 'git' });
            return;
          }

          logger.debug('Processing entries from tree', { service: 'git', count: entries.length, treeOid: treeOidToWalk });

          for (const entry of entries) {
            const entryPath = pathPrefix ? `${pathPrefix}/${(entry as any).path}` : (entry as any).path;

            if ((entry as any).type === 'blob') {
              targetFiles.add(entryPath);
              logger.debug('Target has file', { service: 'git', entryPath });

              // Extract the blob directly
              try {
                const blobObj = await git.readObject({
                  fs: fsForGit,
                  dir,
                  oid: (entry as any).oid,
                });

                if (!blobObj.object || typeof blobObj.object === 'string') {
                  logger.error('Blob is invalid', undefined, { service: 'git', entryPath });
                  continue;
                }

                const fullPath = path.join(dir, entryPath);
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.writeFile(fullPath, Buffer.from(blobObj.object as Uint8Array));
                logger.debug('Extracted file', { service: 'git', entryPath });
              } catch (e) {
                logger.error('Error extracting blob', e as Error, { service: 'git', entryPath });
                throw e;
              }
            } else if ((entry as any).type === 'tree') {
              // Recursively walk subtree
              await walkTargetTree((entry as any).oid, entryPath);
            }
          }
        } catch (e) {
          logger.error('Error walking tree', e as Error, { service: 'git', treeOid: treeOidToWalk });
          throw e;
        }
      };

      await walkTargetTree(treeOid);
      logger.debug('Extracted files from target commit', { service: 'git', count: targetFiles.size });

      // Delete files that exist in current directory but not in target
      for (const filePath of currentFiles) {
        if (!targetFiles.has(filePath)) {
          const fullPath = path.join(dir, filePath);
          logger.debug('Deleting file not in target', { service: 'git', filePath });
          try {
            await fs.unlink(fullPath);
          } catch (e) {
            logger.error('Error deleting file', e as Error, { service: 'git', filePath });
          }
        }
      }

      // Clean up empty directories
      const cleanupEmptyDirs = async (dirPath: string) => {
        try {
          const entries = await fs.readdir(dirPath);
          for (const entry of entries) {
            if (entry === '.git') continue;
            
            const fullPath = path.join(dirPath, entry);
            const stat = await fs.stat(fullPath);
            
            if (stat.isDirectory()) {
              await cleanupEmptyDirs(fullPath);
              try {
                await fs.rmdir(fullPath);
              } catch (e) {
                // Directory not empty, that's fine
              }
            }
          }
        } catch (e) {
          logger.debug('Error cleaning up dirs', { service: 'git', error: String(e) });
        }
      };

      await cleanupEmptyDirs(dir);
      logger.debug('Cleaned up empty directories', { service: 'git' });

      logger.debug('Staging all changes with git add', { service: 'git' });
      // Stage all changes
      await git.add({
        fs: fsForGit,
        dir,
        filepath: '.',
      });
      logger.info('Complete - all files extracted and staged', { service: 'git' });
    } catch (error) {
      logger.error('stageToRevert error', error as Error, { service: 'git' });
      throw error;
    }
  }

  async listBranches(appId: string): Promise<string[]> {
    try {
      const dir = await this.getRepoPath(appId);
      return await git.listBranches({ fs: fsForGit, dir });
    } catch (error: any) {
      throw new AppError(500, `Failed to list branches: ${error.message}`);
    }
  }

  async revert(appId: string, targetOid: string): Promise<string> {
    try {
      const dir = await this.getRepoPath(appId);
      logger.info('Starting revert', { service: 'git', appId, targetOid });
      // Verify git repo exists
      const gitDir = path.join(dir, '.git');
      if (!fsSync.existsSync(gitDir)) {
        throw new Error(`Git repository not found at ${gitDir}`);
      }
      logger.debug('Checking out to main branch', { service: 'git', appId });
      try {
        await git.checkout({
          fs: fsForGit,
          dir,
          ref: 'main',
          force: true,
        });
      } catch (e) {
        logger.debug('Could not checkout main, trying master', { service: 'git', appId });
        try {
          await git.checkout({
            fs: fsForGit,
            dir,
            ref: 'master',
            force: true,
          });
        } catch (e2) {
          logger.warn('Could not checkout main or master', { service: 'git', appId });
          throw new Error(`Could not checkout to main or master branch: ${(e as any).message}`);
        }
      }
      // Stage the target commit's files using statusMatrix approach (from original_dyad)
      logger.debug('Staging files from target commit', { service: 'git', appId, targetOid });
      await this.stageToRevert(dir, targetOid);
      // Create a new commit with the revert message
      const revertMessage = `Reverted all changes back to version ${targetOid}`;
      logger.debug('Creating revert commit', { service: 'git', appId, message: revertMessage });
      const newSha = await git.commit({
        fs: fsForGit,
        dir,
        message: revertMessage,
        author: {
          name: 'Dyad',
          email: 'dyad@app.com',
        },
      });
      logger.info('Revert successful', { service: 'git', appId, newSha });
      return newSha;
    } catch (error: any) {
      logger.error('Revert failed', error, { service: 'git', appId, targetOid });
      throw new AppError(500, `Failed to revert to commit ${targetOid}: ${error.message}`);
    }
  }

   async saveGithubToken(
    userId: string,
    accessToken: string
  ): Promise<void> {
    const encrypted = encryptGitToken(accessToken);
    await db
      .insert(gitIntegrations)
      .values({
        userId,
        provider: 'github',
        accessTokenEncrypted: encrypted.encrypted,
        accessTokenIv: encrypted.iv,
        accessTokenTag: encrypted.tag,
      })
      .onConflictDoUpdate({
        target: [gitIntegrations.userId, gitIntegrations.provider],
        set: {
          accessTokenEncrypted: encrypted.encrypted,
          accessTokenIv: encrypted.iv,
          accessTokenTag: encrypted.tag,
          updatedAt: new Date(),
        },
      });
  }

  async getGithubAccessToken(userId: string): Promise<string> {
  const [row] = await db
    .select()
    .from(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, 'github')
      )
    )
    .limit(1);
  if (!row) {
    throw new AppError(401, 'GitHub not connected');
  }
  return decryptGitToken({
    encrypted: row.accessTokenEncrypted,
    iv: row.accessTokenIv,
    tag: row.accessTokenTag,
  });
}

async getGithubUser(token: string): Promise<{ login: string }> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new AppError(401, 'Failed to fetch GitHub user');
  }
  const data = (await res.json()) as { login: string };
  return data;
}

async getGithubSuggestion(appId: string, userId: string) {
  const [app] = await db
    .select()
    .from(apps)
    .where(eq(apps.id, Number(appId)));
  if (!app) {
    throw new AppError(404, 'App not found');
  }
  const token = await this.getGithubAccessToken(userId);
  const githubUser = await this.getGithubUser(token);
  return {
    org: githubUser.login,
    repo: app.name,  
    branch: 'main',
  };
}


async listGithubRepoBranches(
  userId: string,
  org: string,
  repo: string
) {
  const token = await this.getGithubAccessToken(userId);
  const res = await fetch(
    `https://api.github.com/repos/${org}/${repo}/branches`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    }
  );
  if (!res.ok) {
    throw new AppError(
      500,
      `Failed to fetch branches for ${org}/${repo}`
    );
  }
  const branches = (await res.json()) as {
    name: string;
    protected: boolean;
  }[];
  return branches.map((branch) => ({
    name: branch.name,
    protected: branch.protected,
  }));
}

async listGithubRepos(userId: string) {
  const token = await this.getGithubAccessToken(userId);
  const repoRes = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!repoRes.ok) {
    throw new AppError(500, 'Failed to fetch GitHub repositories');
  }
  const repos = (await repoRes.json()) as GithubRepoApiResponse[];
  //Fetch branches per repo
  const result = await Promise.all(
    repos.map(async (repo) => {
      const branchRes = await fetch(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/branches`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );
      if (!branchRes.ok) {
        throw new AppError(
          500,
          `Failed to fetch branches for ${repo.name}`
        );
      }
      const branches = (await branchRes.json()) as {
        name: string;
        protected: boolean;
      }[];
      return {
        org: repo.owner.login,
        repo: repo.name,
        defaultBranch: repo.default_branch,
        visibility:
          repo.visibility ??
          (repo.private ? 'private' : 'public'),
        branches: branches.map((b) => ({
          name: b.name,
        })),
      };
    })
  );
  return result;
}

async createGithubRepo(
  userId: string,
  repo: string,
  branch: string
) {
  //Get GitHub access token
  const token = await this.getGithubAccessToken(userId);
  //Fetch GitHub user (org / owner)
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!userRes.ok) {
    throw new AppError(500, 'Failed to fetch GitHub user');
  }
  const user = (await userRes.json()) as { login: string };
  const org = user.login;
  //Create GitHub repository
  const createRes = await fetch(
    'https://api.github.com/user/repos',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        name: repo,
        private: true,
        auto_init: false,
      }),
    }
  );
  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new AppError(
      500,
      `Failed to create GitHub repo: ${errorText}`
    );
  }
  return {
    org,
    repo,
    branch,
  };
}

async syncToGithub(
  appId: string,
  userId: string,
  github: { org: string; repo: string; branch: string },
  force: boolean = false
) {
  const dir = await this.getRepoPath(appId);
  const token = await this.getGithubAccessToken(userId);
  const { org, repo, branch } = github;
  const remoteUrl = `https://github.com/${org}/${repo}.git`;
  // Load previous repo config
  const existingApp = await db
    .select()
    .from(apps)
    .where(eq(apps.id, Number(appId)))
    .then(rows => rows[0]);
  const repoChanged =
    existingApp?.githubOrg &&
    existingApp?.githubRepo &&
    (existingApp.githubOrg !== org || existingApp.githubRepo !== repo);
  if (repoChanged && !force) {
    throw new AppError(409, 'rejected non-fast-forward');
  }
  const isFirstTimeConnect =
    !existingApp?.githubOrg &&
    !existingApp?.githubRepo &&
    !existingApp?.githubBranch;
  //Ensure remote exists
  const remotes = await git.listRemotes({ fs: fsForGit, dir });
  if (!remotes.find(r => r.remote === 'origin')) {
    await git.addRemote({
      fs: fsForGit,
      dir,
      remote: 'origin',
      url: remoteUrl,
    });
  } else {
    await git.setConfig({
      fs: fsForGit,
      dir,
      path: 'remote.origin.url',
      value: remoteUrl,
    });
  }
  //Fetch latest from remote (skip if no HEAD exists yet - brand new repo)
  let hasHead = true;
  try {
    await git.fetch({
      fs: fsForGit,
      http,
      dir,
      remote: 'origin',
      onAuth: () => ({ username: token, password: '' }),
    });
  } catch (err: any) {
    // If HEAD doesn't exist yet (brand new repo), continue
    if (err.code === 'NotFoundError' && err.data?.what === 'HEAD') {
      logger.info('No HEAD found - new repo, skipping fetch', { service: 'git', appId });
      hasHead = false;
    } else {
      throw err;
    }
  }
  
  // For brand new repos without HEAD, create initial commit first
  if (!hasHead) {
    logger.info('Creating initial commit for new repo', { service: 'git', appId });
    //Stage all files
    await git.add({ fs: fsForGit, dir, filepath: '.' });
    //Create initial commit
    await git.commit({
      fs: fsForGit,
      dir,
      message: 'Initial commit from Vibe-app',
      author: { name: 'Dyad', email: 'dyad@app.com' },
    });
    //Create and checkout the branch
    await git.branch({ fs: fsForGit, dir, ref: branch, checkout: true });
  } else {
    //Ensure local branch exists
    const localBranches = await git.listBranches({ fs: fsForGit, dir });
    if (!localBranches.includes(branch)) {
      await git.branch({ fs: fsForGit, dir, ref: branch });
    }
    //Checkout branch
    await git.checkout({ fs: fsForGit, dir, ref: branch });
  }
  
  const remoteBranches = await git.listBranches({
    fs: fsForGit,
    dir,
    remote: 'origin',
  });
  if (
    remoteBranches.includes(branch) &&
    !force &&
    !isFirstTimeConnect
  ) {
    try {
      await git.pull({
        fs: fsForGit,
        http,
        dir,
        ref: branch,
        singleBranch: true,
        fastForwardOnly: false,
        author: { name: 'Dyad', email: 'dyad@app.com' },
        onAuth: () => ({ username: token, password: '' }),
      });
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Merges with conflicts are not supported')) {
        throw new AppError(409, 'rejected non-fast-forward');
      }
      throw err;
    }
  }
  
  // Only stage and commit again if repo already had HEAD
  let sha: string | null = null;
  if (hasHead) {
    //Stage all files
    await git.add({ fs: fsForGit, dir, filepath: '.' });
    //Commit if changes exist
    const status = await git.statusMatrix({ fs: fsForGit, dir });
    const hasChanges = status.some(
      ([, head, workdir, stage]) => head !== workdir || workdir !== stage
    );
    if (hasChanges) {
      sha = await git.commit({
        fs: fsForGit,
        dir,
        message: force ? 'Force Sync from Vibe-app' : 'Sync from Vibe-app',
        author: { name: 'Dyad', email: 'dyad@app.com' },
      });
    }
  }
  //Push to GitHub
  try {
    await git.push({
      fs: fsForGit,
      http,
      dir,
      remote: 'origin',
      ref: branch,
      force: force,  
      onAuth: () => ({ username: token, password: '' }),
    });
  } catch (err: any) {
    const msg = err?.message || 'Git push failed';
    if (
      !force &&
      (msg.includes('non-fast-forward') ||
        msg.includes('rejected') ||
        msg.includes('remote contains work'))
    ) {
      throw new AppError(409, msg);
    }
    throw err;
  }
  //Save GitHub config
  await db
    .update(apps)
    .set({
      githubOrg: org,
      githubRepo: repo,
      githubBranch: branch,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, Number(appId)));
  return {
    sha,
    success: true,
    forceUsed: force,
  };
}

async disconnectGithub(userId: string) {
  await db
    .delete(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, 'github')
      )
    );
  return { success: true };
}


/**
 * Disconnect/unlink a repository from an app
 * This removes the GitHub repo connection from the app but keeps the GitHub account connected
 */
async disconnectRepo(appId: string, userId: string) {
  const appIdNum = Number.parseInt(appId);
  
  // Verify app belongs to user
  const [app] = await db
    .select()
    .from(apps)
    .where(and(eq(apps.id, appIdNum), eq(apps.user_id, userId)));
  
  if (!app) {
    throw new AppError(404, 'App not found or unauthorized');
  }
  
  // Clear GitHub repo connection fields
  await db
    .update(apps)
    .set({
      githubOrg: null,
      githubRepo: null,
      githubBranch: null,
      updatedAt: new Date(),
    })
    .where(eq(apps.id, appIdNum));
  
  return { success: true };
}

async checkConnectionStatus(userId: string) {
  const rows = await db
    .select()
    .from(gitIntegrations)
    .where(
      and(
        eq(gitIntegrations.userId, userId),
        eq(gitIntegrations.provider, 'github')
      )
    )
    .limit(1);
  return {
    connected: rows.length > 0,
  };
}
}
