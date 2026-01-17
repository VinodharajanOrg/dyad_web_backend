import { apiClient } from "../client";

export interface BranchResult {
  branch: string | null;
  hasGit: boolean;
}

export interface GitBranch {
  name: string;
  commit: { sha: string };
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface CheckoutParams {
  appId: number;
  versionId: string;
}

export interface RenameBranchParams {
  appId: number;
  oldBranchName: string;
  newBranchName: string;
}

export const gitApi = {
  // Get current branch
  getCurrentBranch: async (appId: number): Promise<BranchResult> => {
    return await apiClient.get<BranchResult>(`/git/${appId}/branch`);
  },

  // List all branches
  listBranches: async (appId: number): Promise<GitBranch[]> => {
    return await apiClient.get<GitBranch[]>(`/git/${appId}/branches`);
  },

  // Get commit log (versions)
  getCommitLog: async (appId: number): Promise<GitCommit[]> => {
    return await apiClient.get<GitCommit[]>(`/git/${appId}/log`);
  },

  // Checkout a commit or branch
  checkout: async (params: CheckoutParams): Promise<void> => {
    await apiClient.post<void>(`/git/${params.appId}/checkout`, {
      ref: params.versionId,
    });
  },

  // Get repository status
  getStatus: async (appId: number): Promise<GitStatus> => {
    return await apiClient.get<GitStatus>(`/git/${appId}/status`);
  },

  // Initialize git repository
  init: async (appId: number): Promise<void> => {
    await apiClient.post<void>(`/git/${appId}/init`);
  },

  // Stage files
  add: async (appId: number, files: string[]): Promise<void> => {
    await apiClient.post<void>(`/git/${appId}/add`, { files });
  },

  // Commit changes
  commit: async (appId: number, message: string): Promise<void> => {
    await apiClient.post<void>(`/git/${appId}/commit`, { message });
  },

  // Push to remote
  push: async (
    appId: number,
    remote?: string,
    branch?: string,
  ): Promise<void> => {
    await apiClient.post<void>(`/git/${appId}/push`, { remote, branch });
  },

  // Clone repository
  clone: async (appId: number, url: string, path?: string): Promise<void> => {
    await apiClient.post<void>(`/git/${appId}/clone`, { url, path });
  },

  renameBranch: async (params: RenameBranchParams): Promise<void> => {
    await apiClient.post<void>(`/git/${params.appId}/rename-branch`, {
      oldName: params.oldBranchName,
      newName: params.newBranchName,
    });
  },
};
