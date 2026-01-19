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

  constructor() {
    // Use the same base directory as AppService for consistency
    // APPS_BASE_DIR is set in .env, defaults to ./apps
    this.baseDir = process.env.APPS_BASE_DIR || process.env.DATA_DIR || path.join(__dirname, '../../data/apps');
  }

  /**
   * Get the actual app directory path from the database
   * The appId parameter can be numeric, but we need the real path stored in the database
   */
  private async getRepoPath(appId: string): Promise<string> {
    try {
      const appIdNum = Number.parseInt(appId);
      const [app] = await db.select().from(apps).where(eq(apps.id, appIdNum));
      
      if (!app) {
        // Fallback to appId-based path if app not found
        console.warn(`[GitService.getRepoPath] App ${appId} not found in database, falling back to numeric path`);
        return path.join(this.baseDir, appId);
      }
      
      // Use the actual app.path from database (already contains full or relative path)
      return app.path;
    } catch (error: any) {
      console.error(`[GitService.getRepoPath] Error fetching app path for ${appId}:`, error.message);
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
        console.log(`[GitService.add] Staging file: ${filepath}`);

        await git.add({
          fs: fsForGit,
          dir,
          filepath,
        });
      }
    }

    console.log(`[GitService.add] All changes staged for appId=${appId}`);
  } catch (error: any) {
    console.error(`[GitService.add] FAILED for appId=${appId}:`, error);
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
      
      console.log(`[GitService.commit] Starting commit for appId=${appId}, message="${message}"`);
      
      // Check the index
      try {
        const status = await git.statusMatrix({ fs: fsForGit, dir });
        console.log(`[GitService.commit] Git status matrix (staged changes):`, status.slice(0, 10));
      } catch (e) {
        console.log(`[GitService.commit] Could not get status matrix:`, (e as any).message);
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
      
      console.log(`[GitService.commit] Commit successful for appId=${appId}, sha=${sha}`);
      
      return sha;
    } catch (error: any) {
      console.error(`[GitService.commit] FAILED for appId=${appId}:`, error);
      throw new AppError(500, `Failed to commit: ${error.message}`);
    }
  }

  async log(appId: string, depth: number = 10): Promise<any[]> {
    try {
      const dir = await this.getRepoPath(appId);
      
      console.log(`[GitService.log] Starting log for appId=${appId}, dir=${dir}`);
      
      // Check if .git directory exists
      const gitDir = path.join(dir, '.git');
      if (!fsSync.existsSync(gitDir)) {
        // Repository not initialized yet, return empty list
        console.log(`[GitService.log] No .git directory found at ${gitDir}, returning empty list`);
        return [];
      }
      
      let commits: any[] = [];
      
      // Try to log from 'main' branch first (most common default branch)
      // This ensures we get ALL commits even if we're in a detached HEAD state
      // Use fsForGit which has both sync and async fs methods
      try {
        console.log(`[GitService.log] Trying to get commits from 'main' branch`);
        commits = await git.log({
          fs: fsForGit,
          dir,
          ref: 'main',
          depth,
        });
        console.log(`[GitService.log] Got ${commits.length} commits from 'main'`);
      } catch (e) {
        // If 'main' doesn't exist, try 'master' (older git convention)
        console.log(`[GitService.log] 'main' branch not found, trying 'master'`);
        try {
          commits = await git.log({
            fs: fsForGit,
            dir,
            ref: 'master',
            depth,
          });
          console.log(`[GitService.log] Got ${commits.length} commits from 'master'`);
        } catch (e2) {
          // If neither branch exists, fall back to current HEAD
          // This handles the case of first commit (before branches exist)
          console.log(`[GitService.log] 'master' branch not found, trying HEAD`);
          commits = await git.log({
            fs: fsForGit,
            dir,
            depth,
          });
          console.log(`[GitService.log] Got ${commits.length} commits from HEAD`);
        }
      }
      
      const result = commits.map(commit => ({
        oid: commit.oid,
        message: commit.commit.message,
        author: commit.commit.author,
        timestamp: commit.commit.author.timestamp,
      }));
      
      console.log(`[GitService.log] Returning ${result.length} formatted commits for appId=${appId}`);
      
      return result;
    } catch (error: any) {
      // Log the error but return empty array for non-critical failures
      console.error(`[GitService.log] Error getting commits for appId=${appId}:`, error.message);
      // Return empty array instead of throwing to allow UI to show "No versions"
      return [];
    }
  }

  async checkout(appId: string, ref: string): Promise<void> {
    try {
      const dir = await this.getRepoPath(appId);
      console.log(`[GitService.checkout] Starting: appId=${appId}, ref=${ref}, dir=${dir}`);
      
      // Verify git repo exists
      const gitDir = path.join(dir, '.git');
      if (!fsSync.existsSync(gitDir)) {
        throw new Error(`Git repository not found at ${gitDir}`);
      }
      console.log(`[GitService.checkout] Git repo confirmed at ${gitDir}`);
      
      // List ALL files in working directory to see what we're working with
      const allFiles = await fs.readdir(dir, { recursive: false }).catch(() => []);
      console.log(`[GitService.checkout] Directory structure of ${dir}:`, allFiles);
      
      // Get files before checkout for diagnostics
      const srcDir = path.join(dir, 'src');
      const before = await fs.readdir(srcDir).catch(() => []);
      console.log(`[GitService.checkout] Files in src/ BEFORE checkout:`, before.slice(0, 5));

      // Check what branches exist
      try {
        const branches = await git.listBranches({ fs: fsForGit, dir });
        console.log(`[GitService.checkout] Available branches:`, branches);
      } catch (e) {
        console.log(`[GitService.checkout] Could not list branches:`, (e as any).message);
      }

      // Check if the ref exists as a commit
      try {
        const resolvedRef = await git.resolveRef({ fs: fsForGit, dir, ref });
        console.log(`[GitService.checkout] Resolved ref "${ref}" to commit:`, resolvedRef);
      } catch (e) {
        console.log(`[GitService.checkout] Could not resolve ref "${ref}":`, (e as any).message);
      }

      // ref can be a commit hash (oid) or branch name
      // Use force: true to allow checking out to detached HEAD state
      // Pass fsForGit which has both sync and async fs methods
      console.log(`[GitService.checkout] About to call git.checkout with ref="${ref}"`);
      
      const result = await git.checkout({ 
        fs: fsForGit, 
        dir, 
        ref,
        force: true,  // Allow checkout even if working directory has changes
      });

      // Get files after checkout to verify they changed
      const after = await fs.readdir(srcDir).catch(() => []);
      console.log(`[GitService.checkout] Files in src/ AFTER checkout:`, after.slice(0, 5));
      
      // List all files again after checkout
      const allFilesAfter = await fs.readdir(dir, { recursive: false }).catch(() => []);
      console.log(`[GitService.checkout] Directory structure AFTER checkout:`, allFilesAfter);
      
      console.log(`[GitService.checkout] Checkout successful: appId=${appId}, ref=${ref}`, result);
    } catch (error: any) {
      console.error(`[GitService.checkout] FAILED: appId=${appId}, ref=${ref}, error=`, error);
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
    console.log(`[GitService.stageToRevert] Starting for target ${targetOid}`);

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
          console.log(`[GitService.stageToRevert] Error walking directory ${dirPath}:`, e);
        }
      };

      await walkCurrentDir(dir);
      console.log(`[GitService.stageToRevert] Found ${currentFiles.size} current files in working directory`);

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

      console.log(`[GitService.stageToRevert] Target tree OID: ${treeOid}`);

      // Walk the target tree to get all files
      const walkTargetTree = async (treeOidToWalk: string, pathPrefix: string = '') => {
        try {
          const treeObj = await git.readObject({
            fs: fsForGit,
            dir,
            oid: treeOidToWalk,
          });

          if (!treeObj.object || typeof treeObj.object === 'string') {
            console.log(`[GitService.stageToRevert] Tree object is invalid`);
            return;
          }

          const treeData = treeObj.object as any;
          
          // Debug: log the structure
          console.log(`[GitService.stageToRevert] Tree data keys: ${Object.keys(treeData).join(', ')}`);
          console.log(`[GitService.stageToRevert] treeData.entries type: ${typeof treeData.entries}`);
          
          // isomorphic-git returns tree entries as numeric-indexed array-like object
          // Get all values from the object (which are the tree entries)
          const entries: any[] = Object.values(treeData).filter((entry: any) => {
            return entry && typeof entry === 'object' && (entry.path || entry.oid);
          });
          
          if (entries.length === 0) {
            console.log(`[GitService.stageToRevert] Tree has no entries after filtering`);
            return;
          }

          console.log(`[GitService.stageToRevert] Processing ${entries.length} entries from tree ${treeOidToWalk}`);

          for (const entry of entries) {
            const entryPath = pathPrefix ? `${pathPrefix}/${(entry as any).path}` : (entry as any).path;

            if ((entry as any).type === 'blob') {
              targetFiles.add(entryPath);
              console.log(`[GitService.stageToRevert] Target has file: ${entryPath}`);

              // Extract the blob directly
              try {
                const blobObj = await git.readObject({
                  fs: fsForGit,
                  dir,
                  oid: (entry as any).oid,
                });

                if (!blobObj.object || typeof blobObj.object === 'string') {
                  console.error(`[GitService.stageToRevert] Blob is invalid: ${entryPath}`);
                  continue;
                }

                const fullPath = path.join(dir, entryPath);
                await fs.mkdir(path.dirname(fullPath), { recursive: true });
                await fs.writeFile(fullPath, Buffer.from(blobObj.object as Uint8Array));
                console.log(`[GitService.stageToRevert] Extracted: ${entryPath}`);
              } catch (e) {
                console.error(`[GitService.stageToRevert] Error extracting blob ${entryPath}:`, e);
                throw e;
              }
            } else if ((entry as any).type === 'tree') {
              // Recursively walk subtree
              await walkTargetTree((entry as any).oid, entryPath);
            }
          }
        } catch (e) {
          console.error(`[GitService.stageToRevert] Error walking tree ${treeOidToWalk}:`, e);
          throw e;
        }
      };

      await walkTargetTree(treeOid);
      console.log(`[GitService.stageToRevert] Extracted ${targetFiles.size} files from target commit`);

      // Delete files that exist in current directory but not in target
      for (const filePath of currentFiles) {
        if (!targetFiles.has(filePath)) {
          const fullPath = path.join(dir, filePath);
          console.log(`[GitService.stageToRevert] Deleting file not in target: ${filePath}`);
          try {
            await fs.unlink(fullPath);
          } catch (e) {
            console.error(`[GitService.stageToRevert] Error deleting ${filePath}:`, e);
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
          console.log(`[GitService.stageToRevert] Error cleaning up dirs:`, e);
        }
      };

      await cleanupEmptyDirs(dir);
      console.log(`[GitService.stageToRevert] Cleaned up empty directories`);

      console.log(`[GitService.stageToRevert] Staging all changes with git add`);
      // Stage all changes
      await git.add({
        fs: fsForGit,
        dir,
        filepath: '.',
      });
      console.log(`[GitService.stageToRevert] Complete - all files extracted and staged`);
    } catch (error) {
      console.error(`[GitService.stageToRevert] Error:`, error);
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
      console.log(`[GitService.revert] Starting revert for appId=${appId}, targetOid=${targetOid}`);
      // Verify git repo exists
      const gitDir = path.join(dir, '.git');
      if (!fsSync.existsSync(gitDir)) {
        throw new Error(`Git repository not found at ${gitDir}`);
      }
      console.log(`[GitService.revert] Checking out to main branch to ensure we're on a proper branch`);
      try {
        await git.checkout({
          fs: fsForGit,
          dir,
          ref: 'main',
          force: true,
        });
      } catch (e) {
        console.log(`[GitService.revert] Could not checkout main, trying master`);
        try {
          await git.checkout({
            fs: fsForGit,
            dir,
            ref: 'master',
            force: true,
          });
        } catch (e2) {
          console.warn(`[GitService.revert] Could not checkout main or master`);
          throw new Error(`Could not checkout to main or master branch: ${(e as any).message}`);
        }
      }
      // Stage the target commit's files using statusMatrix approach (from original_dyad)
      console.log(`[GitService.revert] Staging files from target commit ${targetOid}`);
      await this.stageToRevert(dir, targetOid);
      // Create a new commit with the revert message
      const revertMessage = `Reverted all changes back to version ${targetOid}`;
      console.log(`[GitService.revert] Creating revert commit with message: ${revertMessage}`);
      const newSha = await git.commit({
        fs: fsForGit,
        dir,
        message: revertMessage,
        author: {
          name: 'Dyad',
          email: 'dyad@app.com',
        },
      });
      console.log(`[GitService.revert] Revert successful! New commit SHA: ${newSha}`);
      return newSha;
    } catch (error: any) {
      console.error(`[GitService.revert] FAILED: appId=${appId}, targetOid=${targetOid}, error=`, error);
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
  //Fetch latest from remote
  await git.fetch({
    fs: fsForGit,
    http,
    dir,
    remote: 'origin',
    onAuth: () => ({ username: token, password: '' }),
  });
  //Ensure local branch exists
  const localBranches = await git.listBranches({ fs: fsForGit, dir });
  if (!localBranches.includes(branch)) {
    await git.branch({ fs: fsForGit, dir, ref: branch });
  }
  //Checkout branch
  await git.checkout({ fs: fsForGit, dir, ref: branch });
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
  //Stage all files
  await git.add({ fs: fsForGit, dir, filepath: '.' });
  //Commit if changes exist
  const status = await git.statusMatrix({ fs: fsForGit, dir });
  const hasChanges = status.some(
    ([, head, workdir, stage]) => head !== workdir || workdir !== stage
  );
  let sha: string | null = null;
  if (hasChanges) {
    sha = await git.commit({
      fs: fsForGit,
      dir,
      message: force ? 'Force Sync from Vibe-app' : 'Sync from Vibe-app',
      author: { name: 'Dyad', email: 'dyad@app.com' },
    });
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
