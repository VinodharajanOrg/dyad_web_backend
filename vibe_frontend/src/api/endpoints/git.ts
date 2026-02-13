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
  oid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
  };
  timestamp: number;
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

export interface RevertParams {
  appId: number;
  versionId: string;
}

export interface GitHubDeviceFlowResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface GitHubDeviceFlowStatusPending {
  status: "pending";
}

export interface GitHubDeviceFlowStatusApproved {
  status: "approved";
  accessToken: string;
}

export interface GitHubDeviceFlowStatusDenied {
  status: "denied";
}

export interface GitHubDeviceFlowStatusExpired {
  status: "expired";
}

export type GitHubDeviceFlowStatusResponse =
  | GitHubDeviceFlowStatusPending
  | GitHubDeviceFlowStatusApproved
  | GitHubDeviceFlowStatusDenied
  | GitHubDeviceFlowStatusExpired;

export interface GitHubSuggestion {
  org: string;
  repo: string;
  branch: string;
}

export interface GitHubSuggestionResponse {
  data: GitHubSuggestion;
}

export interface CreateGitHubRepoRequest {
  repo: string;
  branch: string;
}

export interface CreateGitHubRepoData {
  org: string;
  repo: string;
  branch: string;
}

export interface CreateGitHubRepoResponse {
  success: boolean;
  message: string;
  data: CreateGitHubRepoData;
}

export interface GitHubBranchInfo {
  name: string;
}

export interface GitHubRepoInfo {
  org: string;
  repo: string;
  defaultBranch: string;
  visibility: string;
  branches: GitHubBranchInfo[];
}

export interface SyncGitHubRepoRequest {
  org: string;
  repo: string;
  branch: string;
  force: boolean;
}

export interface SyncGitHubRepoResponse {
  success: boolean;
  message: string;
  data: {
    sha: string;
    forceUsed: boolean;
  };
}

export interface ListGitHubReposResponse {
  data: GitHubRepoInfo[];
}

export interface GitConnectionStatusResponse {
  data: {
    connected: boolean;
  };
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

  // Rename branch
  renameBranch: async (params: RenameBranchParams): Promise<void> => {
    await apiClient.post<void>(`/git/${params.appId}/rename-branch`, {
      oldName: params.oldBranchName,
      newName: params.newBranchName,
    });
  },

  // Revert to a previous commit by creating a new commit with that commit's state
  revert: async (params: RevertParams): Promise<{ newSha: string }> => {
    return await apiClient.post<{ newSha: string }>(`/git/${params.appId}/revert`, {
      targetOid: params.versionId,
    });
  },

  // Start GitHub device flow for OAuth authentication
  startGitHubDeviceFlow: async (): Promise<GitHubDeviceFlowResponse> => {
    return await apiClient.post<GitHubDeviceFlowResponse>(
      `/git/start`,
    );
  },

  // Check GitHub device flow status (pending or approved)
  getGitHubDeviceFlowStatus: async (
    deviceCode: string,
  ): Promise<GitHubDeviceFlowStatusResponse> => {
    return await apiClient.get<GitHubDeviceFlowStatusResponse>(
      `/git/tokenStatus?deviceCode=${deviceCode}`,
    );
  },

  // Get GitHub suggestion for an app
  getGitHubSuggestion: async (appId: number): Promise<GitHubSuggestion> => {
    const response = await apiClient.get<GitHubSuggestion>(
      `/git/${appId}/repoSuggestion`,
    );
    return response;
  },

  // Create a new GitHub repository
  createGitHubRepo: async (
    appId: number,
    repo: string,
    branch: string,
    org?: string,
  ): Promise<CreateGitHubRepoData> => {
    const response = await apiClient.post<CreateGitHubRepoResponse>(
      `/git/${appId}/createRepo`,
      {
        repo,
        branch,
        org: org || "mastercard-sendbox",
      },
    );
    // The response should be the entire response object with nested data
    // If it's wrapped, extract the data property, otherwise use it directly
    return (response as any).data || response;
  },

  // List all GitHub repositories
  listGitHubRepos: async (): Promise<GitHubRepoInfo[]> => {
    const response = await apiClient.get<any>(
      `/git/repos`,
    );
    // Handle both response.data (if wrapped) and response as array
    const repos = Array.isArray(response) ? response : Array.isArray(response.data) ? response.data : response.data?.data || [];
    return repos;
  },

  // Sync (push) code to GitHub repository
  syncGitHubRepo: async (
    appId: number,
    org: string,
    repo: string,
    branch: string,
    force: boolean = false,
  ): Promise<{ sha: string; forceUsed: boolean }> => {
    try {
      const response = await apiClient.post<any>(
        `/git/${appId}/sync`,
        {
          org,
          repo,
          branch,
          force,
        },
      );
      
      // Check if response contains an error field (409 responses may not throw)
      if (response?.error) {
        throw new Error(response.error);
      }
      
      return response.data;
    } catch (err: any) {
      // If error has an error field, use that as the message
      const errorMessage = err.response?.data?.error || err.data?.error || err.message;
      throw new Error(errorMessage);
    }
  },

  // Disconnect repository from app (keeps GitHub account connected)
  disconnectRepo: async (appId: number): Promise<{ success: boolean }> => {
    const response = await apiClient.delete<{ success: boolean }>(
      `/git/${appId}/disconnect`,
    );
    return response;
  },

  // Disconnect GitHub account completely
  disconnectGitHub: async (): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{
      success: boolean;
      message: string;
    }>(`/git/disconnect`);
    return response;
  },

  // Check GitHub connection status
  checkConnectionStatus: async (): Promise<boolean> => {
    const response = await apiClient.get<{ connected: boolean }>(
      `/git/checkConnectionStatus`,
    );
    return response.connected;
  },
};
