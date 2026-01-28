"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Github,
  Clipboard,
  Check,
  ChevronRight,
} from "lucide-react";
import { ForcePushDialog } from "@/components/github/ForcePushDialog";
import { ForcePushButton } from "@/components/github/ForcePushButton";
import { IpcClient } from "@/api/ipc_client";
import { gitApi } from "@/api/endpoints/git";
import { useSettings } from "@/hooks/useSettings";
import { useLoadApp } from "@/hooks/useLoadApp";
import { openExternalUrl } from "@/utils/openExternalUrl";
import { COPY_FEEDBACK_DURATION, GITHUB_SYNC_POLLING_INTERVAL } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GitHubConnectorProps {
  appId: number | null;
  folderName: string;
  expanded?: boolean;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  private: boolean;
  org?: string;
  defaultBranch?: string;
  branches?: GitHubBranch[];
}

interface GitHubBranch {
  name: string;
  commit?: { sha: string };
}

interface ConnectedGitHubConnectorProps {
  appId: number;
  app: any;
  refreshApp: () => void;
  triggerAutoSync?: boolean;
  onAutoSyncComplete?: () => void;
}

export interface UnconnectedGitHubConnectorProps {
  appId: number | null;
  folderName: string;
  settings: any;
  refreshSettings: () => void;
  handleRepoSetupComplete: () => void;
  refreshApp: () => void;
  expanded?: boolean;
}

function ConnectedGitHubConnector({
  appId,
  app,
  refreshApp,
  triggerAutoSync,
  onAutoSyncComplete,
}: ConnectedGitHubConnectorProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const [showForceDialog, setShowForceDialog] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [connectionCheckError, setConnectionCheckError] = useState<string | null>(null);
  const autoSyncTriggeredRef = useRef(false);
  const queryClient = useQueryClient();

  const handleDisconnectRepo = async () => {
    setIsDisconnecting(true);
    setDisconnectError(null);
    try {
      // Disconnect repo from this app only (keeps GitHub account connected)
      await gitApi.disconnectRepo(appId);
      
      // Update the cached app data to remove GitHub repo config
      queryClient.setQueryData(
        ["app", appId],
        (oldData: any) => {
          if (oldData) {
            return {
              ...oldData,
              githubOrg: null,
              githubRepo: null,
              githubBranch: null,
            };
          }
          return oldData;
        }
      );
      
      // Refresh app data to show UnconnectedGitHubConnector
      await refreshApp();
    } catch (err: any) {
      setDisconnectError(err.message || "Failed to disconnect repository.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const verifyAndSync = async (force: boolean = false) => {
    setIsVerifying(true);
    setConnectionCheckError(null);
    setSyncError(null);
    setSyncSuccess(false);
    setShowForceDialog(false);

    try {
      // Step 1: Check if GitHub is authenticated
      const isConnected = await gitApi.checkConnectionStatus();

      if (!isConnected) {
        // If not authenticated, show "Connect to GitHub" option
        setConnectionCheckError(
          "Not authenticated with GitHub. Please connect your GitHub account first."
        );
        setIsVerifying(false);
        // Trigger app refresh to show UnconnectedGitHubConnector
        await refreshApp();
        return;
      }

      // Step 2: Check if repo is configured
      if (!app.githubOrg || !app.githubRepo) {
        // If repo not configured, show "Create Repo" or "Connect to existing Repo" options
        setConnectionCheckError(
          "GitHub is connected but repository is not configured. Please set up a repository."
        );
        setIsVerifying(false);
        // Trigger app refresh which will show UnconnectedGitHubConnector with repo setup options
        await refreshApp();
        return;
      }

      // Step 3: If both checks pass, proceed with sync
      setIsVerifying(false);
      await handleSyncToGithub(force);
    } catch (err: any) {
      setConnectionCheckError(
        err.message || "Failed to verify connection status."
      );
      setIsVerifying(false);
    }
  };

  const handleSyncToGithub = useCallback(
    async (force: boolean = false) => {
      setIsSyncing(true);
      setSyncError(null);
      setSyncSuccess(false);
      setShowForceDialog(false);

      try {
        await gitApi.syncGitHubRepo(
          appId,
          app.githubOrg,
          app.githubRepo,
          app.githubBranch || "main",
          force,
        );
        setSyncSuccess(true);
      } catch (err: any) {
        setSyncError(err.message || "Failed to sync to GitHub.");
        // If it's a push rejection error, show the force dialog
        if (
          err.message?.includes("rejected") ||
          err.message?.includes("non-fast-forward")
        ) {
          // Don't show force dialog immediately, let user see the error first
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [appId, app.githubOrg, app.githubRepo, app.githubBranch],
  );

  // Auto-sync when triggerAutoSync prop is true
  useEffect(() => {
    if (triggerAutoSync && !autoSyncTriggeredRef.current) {
      autoSyncTriggeredRef.current = true;
      handleSyncToGithub(false).finally(() => {
        onAutoSyncComplete?.();
      });
    } else if (!triggerAutoSync) {
      // Reset the ref when triggerAutoSync becomes false
      autoSyncTriggeredRef.current = false;
    }
  }, [triggerAutoSync]); // Only depend on triggerAutoSync to avoid unnecessary re-runs

  return (
    <div className="w-full" data-testid="github-connected-repo">
      <p>Connected to GitHub Repo:</p>
      <a
        onClick={(e) => {
          e.preventDefault();
          openExternalUrl(
            `https://github.com/${app.githubOrg}/${app.githubRepo}`,
          );
        }}
        className="cursor-pointer text-blue-600 hover:underline dark:text-blue-400"
        target="_blank"
        rel="noopener noreferrer"
      >
        {app.githubOrg}/{app.githubRepo}
      </a>
      {app.githubBranch && (
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Branch: <span className="font-mono">{app.githubBranch}</span>
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <Button onClick={() => verifyAndSync(false)} disabled={isSyncing || isVerifying}>
          {isSyncing || isVerifying ? (
            <>
              <svg
                className="animate-spin h-5 w-5 mr-2 inline"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                style={{ display: "inline" }}
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {isVerifying ? "Verifying..." : "Syncing..."}
            </>
          ) : (
            "Sync to GitHub"
          )}
        </Button>
        <Button
          onClick={handleDisconnectRepo}
          disabled={isDisconnecting}
          variant="outline"
        >
          {isDisconnecting ? "Disconnecting..." : "Disconnect from repo"}
        </Button>
      </div>
      {connectionCheckError && (
        <p className="text-red-600 mt-2">{connectionCheckError}</p>
      )}
      {syncError && (
        <div className="mt-2">
          <p className="text-red-600">
            {syncError}{" "}
            <a
              onClick={(e) => {
                e.preventDefault();
                openExternalUrl(
                  "https://www.dyad.sh/docs/integrations/github#troubleshooting",
                );
              }}
              className="cursor-pointer text-blue-600 hover:underline dark:text-blue-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              See troubleshooting guide
            </a>
          </p>
          {(syncError.includes("rejected") ||
            syncError.includes("non-fast-forward")) && (
            <ForcePushButton onClick={() => setShowForceDialog(true)} />
          )}
        </div>
      )}
      {syncSuccess && (
        <p className="text-green-600 mt-2">Successfully pushed to GitHub!</p>
      )}
      {disconnectError && (
        <p className="text-red-600 mt-2">{disconnectError}</p>
      )}

      {/* Force Push Warning Dialog */}
      <ForcePushDialog
        open={showForceDialog}
        onOpenChange={setShowForceDialog}
        onConfirm={() => handleSyncToGithub(true)}
        isProcessing={isSyncing}
      />
    </div>
  );
}

export function UnconnectedGitHubConnector({
  appId,
  folderName,
  settings,
  refreshSettings,
  handleRepoSetupComplete,
  refreshApp,
  expanded,
}: UnconnectedGitHubConnectorProps) {
  const queryClient = useQueryClient();
  
  // --- Collapsible State ---
  const [isExpanded, setIsExpanded] = useState(expanded || false);

  // --- GitHub Connection Status State ---
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [connectionCheckError, setConnectionCheckError] = useState<string | null>(null);

  // --- GitHub Device Flow State ---
  const [githubUserCode, setGithubUserCode] = useState<string | null>(null);
  const [githubVerificationUri, setGithubVerificationUri] = useState<
    string | null
  >(null);
  const [githubDeviceCode, setGithubDeviceCode] = useState<string | null>(null);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [isConnectingToGithub, setIsConnectingToGithub] = useState(false);
  const [githubStatusMessage, setGithubStatusMessage] = useState<string | null>(
    null,
  );
  const [codeCopied, setCodeCopied] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingIntervalDurationRef = useRef<number>(GITHUB_SYNC_POLLING_INTERVAL); // Start with 8 seconds

  // --- Repo Setup State ---
  const [repoSetupMode, setRepoSetupMode] = useState<"create" | "existing">(
    "create",
  );
  const [availableRepos, setAvailableRepos] = useState<GitHubRepo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [availableBranches, setAvailableBranches] = useState<GitHubBranch[]>(
    [],
  );
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string>("main");
  const [branchInputMode, setBranchInputMode] = useState<"select" | "custom">(
    "select",
  );
  const [customBranchName, setCustomBranchName] = useState<string>("");

  // Create new repo state
  const [repoName, setRepoName] = useState(folderName);
  const [repoAvailable, setRepoAvailable] = useState<boolean | null>(null);
  const [repoCheckError, setRepoCheckError] = useState<string | null>(null);
  const [isCheckingRepo, setIsCheckingRepo] = useState(false);
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [createRepoError, setCreateRepoError] = useState<string | null>(null);
  const [createRepoSuccess, setCreateRepoSuccess] = useState<boolean>(false);
  const [showForceDialog, setShowForceDialog] = useState(false);

  // GitHub suggestion state
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
  const [isAuthorizationComplete, setIsAuthorizationComplete] = useState(false);

  // Update repoName when folderName prop changes (when switching between apps)
  useEffect(() => {
    setRepoName(folderName);
  }, [folderName]);

  // Assume org is the authenticated user for now (could add org input later)
  const githubOrg = ""; // Use empty string for now (GitHub API will default to the authenticated user)

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check GitHub connection status on component mount
  useEffect(() => {
    const checkGitHubConnection = async () => {
      setIsCheckingConnection(true);
      setConnectionCheckError(null);
      try {
        const connected = await gitApi.checkConnectionStatus();
        setIsGitHubConnected(connected);
        if (connected) {
          // If already connected, expand the repo setup section
          setIsExpanded(true);
          setIsAuthorizationComplete(true);
        }
      } catch (err: any) {
        setConnectionCheckError(err.message || "Failed to check GitHub connection");
        setIsGitHubConnected(false);
      } finally {
        setIsCheckingConnection(false);
      }
    };

    checkGitHubConnection();
  }, []);

  const handleConnectToGithub = async () => {
    const ipcClient = IpcClient.getInstance();

    setIsConnectingToGithub(true);
    setGithubError(null);
    setGithubUserCode(null);
    setGithubVerificationUri(null);
    setGithubDeviceCode(null);
    setGithubStatusMessage("Requesting device code from GitHub...");

    try {
      if (ipcClient) {
        // Electron mode: use IPC
        (ipcClient as any).startGithubDeviceFlow(appId);
      } else {
        // Web mode: use API endpoint
        const response = await gitApi.startGitHubDeviceFlow();
        setGithubUserCode(response.userCode);
        setGithubVerificationUri(response.verificationUri);
        setGithubDeviceCode(response.deviceCode);
        setGithubStatusMessage("GitHub device code requested. Please authorize.");
        setIsConnectingToGithub(false);

        // Set polling interval from response (default 8 seconds)
        pollingIntervalDurationRef.current = GITHUB_SYNC_POLLING_INTERVAL;

        // Start polling for device flow approval
        startDeviceFlowPolling(response.deviceCode);
      }
    } catch (err: any) {
      setGithubError(err.message || "Failed to start GitHub device flow");
      setIsConnectingToGithub(false);
    }
  };

  const startDeviceFlowPolling = (deviceCode: string) => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Define the polling function
    const pollStatus = async () => {
      try {
        const status = await gitApi.getGitHubDeviceFlowStatus(deviceCode);

        if (status.status === "approved") {
          // User approved! Set authorization flag and fetch suggestion
          setGithubUserCode(null);
          setGithubVerificationUri(null);
          setGithubError(null);
          setGithubStatusMessage(null);
          setIsAuthorizationComplete(true); // Mark authorization as complete

          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          // Refresh settings to fetch the new GitHub token
          await refreshSettings();

          // Invalidate git connection status query to show integrations section
          queryClient.invalidateQueries({ queryKey: ["git", "connectionStatus"] });

          // Fetch GitHub suggestion for repo setup
          if (appId) {
            setIsFetchingSuggestion(true);
            try {
              const suggestion = await gitApi.getGitHubSuggestion(appId);
              // Pre-populate repo setup with suggestion
              setRepoName(suggestion.repo);
              setSelectedBranch(suggestion.branch);
              setRepoSetupMode("create"); // Default to create mode with suggested name
              setIsExpanded(true); // Auto-expand repo setup section
            } catch (err: any) {
              console.error("Failed to fetch GitHub suggestion:", err);
              // Still expand setup section even if suggestion fails
              setIsExpanded(true);
            } finally {
              setIsFetchingSuggestion(false);
            }
          } else {
            setIsExpanded(true);
          }
        } else if (status.status === "denied") {
          // User explicitly denied access
          setGithubError("GitHub access was denied. Please try again.");
          setGithubUserCode(null);
          setGithubVerificationUri(null);

          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        } else if (status.status === "expired") {
          // Device code expired
          setGithubError("Device code expired. Please start over.");
          setGithubUserCode(null);
          setGithubVerificationUri(null);

          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
        // For "pending", continue polling with current interval
      } catch (err: any) {
        console.error("Error polling device flow status:", err);

        // Check if error is "slow_down" - if so, increase interval
        if (
          err.response?.data?.error?.error === "slow_down" ||
          err.response?.data?.error === "slow_down"
        ) {
          const newInterval = err.response?.data?.error?.interval || 
                             err.response?.data?.interval || 
                             pollingIntervalDurationRef.current * 2;
          console.log(
            `GitHub requested slower polling. New interval: ${newInterval}s`
          );
          pollingIntervalDurationRef.current = newInterval;
        }
        // Continue polling even on error
      }
    };

    // Initial poll
    pollStatus();

    // Set up recurring polls with the configured interval
    pollingIntervalRef.current = setInterval(
      pollStatus,
      pollingIntervalDurationRef.current * 1000
    );
  };

  useEffect(() => {
    // Check if IPC client is available (null in web mode)
    const ipcClient = IpcClient.getInstance();
    if (!ipcClient) {
      // Skip GitHub device flow listeners in web mode
      return;
    }

    const cleanupFunctions: (() => void)[] = [];

    // Listener for updates (user code, verification uri, status messages)
    const removeUpdateListener = (ipcClient as any).onGithubDeviceFlowUpdate(
      (data: any) => {
        if (data.userCode) {
          setGithubUserCode(data.userCode);
        }
        if (data.verificationUri) {
          setGithubVerificationUri(data.verificationUri);
        }
        if (data.message) {
          setGithubStatusMessage(data.message);
        }

        setGithubError(null); // Clear previous errors on new update
        if (!data.userCode && !data.verificationUri && data.message) {
          // Likely just a status message, keep connecting state
          setIsConnectingToGithub(true);
        }
        if (data.userCode && data.verificationUri) {
          setIsConnectingToGithub(true); // Still connecting until success/error
        }
      },
    );
    cleanupFunctions.push(removeUpdateListener);

    // Listener for success
    const removeSuccessListener = (ipcClient as any).onGithubDeviceFlowSuccess(
      (data: any) => {
        setGithubStatusMessage("Successfully connected to GitHub!");
        setGithubUserCode(null); // Clear user-facing info
        setGithubVerificationUri(null);
        setGithubError(null);
        setIsConnectingToGithub(false);
        refreshSettings();
        setIsExpanded(true);
      },
    );
    cleanupFunctions.push(removeSuccessListener);

    // Listener for errors
    const removeErrorListener = (ipcClient as any).onGithubDeviceFlowError(
      (data: any) => {
        setGithubError(data.error || "An unknown error occurred.");
        setGithubStatusMessage(null);
        setGithubUserCode(null);
        setGithubVerificationUri(null);
        setIsConnectingToGithub(false);
      },
    );
    cleanupFunctions.push(removeErrorListener);

    // Cleanup function to remove all listeners when component unmounts or appId changes
    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
      // Reset state when appId changes or component unmounts
      setGithubUserCode(null);
      setGithubVerificationUri(null);
      setGithubError(null);
      setIsConnectingToGithub(false);
      setGithubStatusMessage(null);
    };
  }, []); // Re-run effect if appId changes

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Load available repos when authorization is complete
  useEffect(() => {
    if (isAuthorizationComplete) {
      loadAvailableRepos();
    }
  }, [isAuthorizationComplete]);

  const loadAvailableRepos = async () => {
    setIsLoadingRepos(true);
    try {
      const repos = await gitApi.listGitHubRepos();
      // Transform API response to match GitHubRepo interface
      const transformedRepos: GitHubRepo[] = (repos || []).map((repo) => ({
        name: repo.repo,
        full_name: `${repo.org}/${repo.repo}`,
        private: repo.visibility === "private",
        org: repo.org,
        defaultBranch: repo.defaultBranch,
        branches: repo.branches || [],
      }));
      setAvailableRepos(transformedRepos);
    } catch (error) {
      console.error("Failed to load GitHub repos:", error);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Load branches when a repo is selected
  useEffect(() => {
    if (selectedRepo && repoSetupMode === "existing") {
      loadRepoBranches();
    }
  }, [selectedRepo, repoSetupMode]);

  const loadRepoBranches = async () => {
    if (!selectedRepo) return;

    setIsLoadingBranches(true);
    setBranchInputMode("select"); // Reset to select mode when loading new repo
    setCustomBranchName(""); // Clear custom branch name
    try {
      // Find the selected repo in availableRepos and extract its branches
      const repo = availableRepos.find((r) => r.full_name === selectedRepo);
      const branches = repo?.branches || [];
      
      setAvailableBranches(branches);
      
      // Default to default branch, then main, then master, then first branch
      const defaultBranch =
        repo?.defaultBranch ||
        branches.find(
          (b: any) => b.name === "main" || b.name === "master",
        )?.name ||
        branches[0]?.name ||
        "main";
      
      setSelectedBranch(defaultBranch);
    } catch (error) {
      console.error("Failed to load repo branches:", error);
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const checkRepoAvailability = useCallback(
    async (name: string) => {
      setRepoCheckError(null);
      setRepoAvailable(null);
      if (!name) return;
      setIsCheckingRepo(true);
      try {
        const result = await (
          IpcClient.getInstance() as any
        ).checkGithubRepoAvailable(githubOrg, name);
        setRepoAvailable(result.available);
        if (!result.available) {
          setRepoCheckError(
            result.error || "Repository name is not available.",
          );
        }
      } catch (err: any) {
        setRepoCheckError(err.message || "Failed to check repo availability.");
      } finally {
        setIsCheckingRepo(false);
      }
    },
    [githubOrg],
  );

  const debouncedCheckRepoAvailability = useCallback(
    (name: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        checkRepoAvailability(name);
      }, 500);
    },
    [checkRepoAvailability],
  );

  const handleSetupRepo = async (e?: React.FormEvent, force: boolean = false) => {
    e?.preventDefault();
    if (!appId) return;

    setCreateRepoError(null);
    setIsCreatingRepo(true);
    setCreateRepoSuccess(false);
    setShowForceDialog(false);

    try {
      if (repoSetupMode === "create") {
        // Create repo and immediately sync using response data
        const repoData = await gitApi.createGitHubRepo(appId, repoName, selectedBranch);
        // Sync immediately with the response data (org, repo, branch)
        await gitApi.syncGitHubRepo(appId, repoData.org, repoData.repo, repoData.branch, force);
      } else {
        const repo = availableRepos.find((r) => r.full_name === selectedRepo);
        if (!repo || !repo.org) {
          throw new Error("Invalid repository selection");
        }
        const branchToUse =
          branchInputMode === "custom" ? customBranchName : selectedBranch;
        await gitApi.syncGitHubRepo(appId, repo.org, repo.name, branchToUse, force);
      }

      setCreateRepoSuccess(true);
      setRepoCheckError(null);
      // Immediately refetch app data to show connected repo UI
      await refreshApp();
      handleRepoSetupComplete();
    } catch (err: any) {
      setCreateRepoError(
        err.message ||
          `Failed to ${force ? "force sync" : repoSetupMode === "create" ? "create" : "connect to"} repository.`,
      );

    } finally {
      setIsCreatingRepo(false);
    }
  };

  if (isCheckingConnection) {
    return (
      <div className="mt-1 w-full flex items-center justify-center p-4" data-testid="github-checking-connection">
        <svg
          className="animate-spin h-5 w-5 mr-2"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span>Checking GitHub connection...</span>
      </div>
    );
  }

  if (!settings?.githubAccessToken && !isAuthorizationComplete && !isGitHubConnected) {
    return (
      <div className="mt-1 w-full" data-testid="github-unconnected-repo">
        <Button
          onClick={handleConnectToGithub}
          className="cursor-pointer w-full py-5 flex justify-center items-center gap-2"
          size="lg"
          variant="outline"
          disabled={isConnectingToGithub}
        >
          Connect to GitHub
          <Github className="h-5 w-5" />
          {isConnectingToGithub && (
            <svg
              className="animate-spin h-5 w-5 ml-2"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
        </Button>
        {/* GitHub Connection Status/Instructions */}
        {(githubUserCode || githubStatusMessage || githubError) && (
          <div className="mt-6 p-4 border rounded-md bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600">
            <h4 className="font-medium mb-2">GitHub Connection</h4>
            {githubError && (
              <p className="text-red-600 dark:text-red-400 mb-2">
                Error: {githubError}
              </p>
            )}
            {githubUserCode && githubVerificationUri && (
              <div className="mb-2">
                <p>
                  1. Go to:
                  <a
                    href={githubVerificationUri} // Make it a direct link
                    onClick={(e) => {
                      e.preventDefault();
                      openExternalUrl(githubVerificationUri);
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {githubVerificationUri}
                  </a>
                </p>
                <p>
                  2. Enter code:
                  <strong className="ml-1 font-mono text-lg tracking-wider bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded">
                    {githubUserCode}
                  </strong>
                  <button
                    className="ml-2 p-1 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none"
                    onClick={() => {
                      if (githubUserCode) {
                        navigator.clipboard
                          .writeText(githubUserCode)
                          .then(() => {
                            setCodeCopied(true);
                            setTimeout(
                              () => setCodeCopied(false),
                              COPY_FEEDBACK_DURATION,
                            );
                          })
                          .catch((err) =>
                            console.error("Failed to copy code:", err),
                          );
                      }
                    }}
                    title="Copy to clipboard"
                  >
                    {codeCopied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clipboard className="h-4 w-4" />
                    )}
                  </button>
                </p>
              </div>
            )}
            {githubStatusMessage && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {githubStatusMessage}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full" data-testid="github-setup-repo">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={!isExpanded ? () => setIsExpanded(true) : undefined}
        className={`w-full p-4 text-left transition-colors rounded-md flex items-center justify-between ${
          !isExpanded
            ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
            : ""
        }`}
      >
        <span className="font-medium">Set up your GitHub repo</span>
        {isExpanded ? undefined : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>

      {/* Collapsible Content */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 pt-0 space-y-4">
          {/* Mode Selection */}
          <div>
            <div className="flex rounded-md border border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant={repoSetupMode === "create" ? "default" : "ghost"}
                className={`flex-1 rounded-none rounded-l-md border-0 ${
                  repoSetupMode === "create"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                onClick={() => {
                  setRepoSetupMode("create");
                  setCreateRepoError(null);
                  setCreateRepoSuccess(false);
                }}
              >
                Create new repo
              </Button>
              <Button
                type="button"
                variant={repoSetupMode === "existing" ? "default" : "ghost"}
                className={`flex-1 rounded-none rounded-r-md border-0 border-l border-gray-200 dark:border-gray-700 ${
                  repoSetupMode === "existing"
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                onClick={() => {
                  setRepoSetupMode("existing");
                  setCreateRepoError(null);
                  setCreateRepoSuccess(false);
                }}
              >
                Connect to existing repo
              </Button>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSetupRepo}>
            {repoSetupMode === "create" ? (
              <>
                <div>
                  <Label className="block text-sm font-medium">
                    Repository Name
                  </Label>
                  <Input
                    data-testid="github-create-repo-name-input"
                    className="w-full mt-1"
                    value={repoName}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setRepoName(newValue);
                      setRepoAvailable(null);
                      setRepoCheckError(null);
                      debouncedCheckRepoAvailability(newValue);
                    }}
                    disabled={isCreatingRepo}
                  />
                  {isCheckingRepo && (
                    <p className="text-xs text-gray-500 mt-1">
                      Checking availability...
                    </p>
                  )}
                  {repoAvailable === true && (
                    <p className="text-xs text-green-600 mt-1">
                      Repository name is available!
                    </p>
                  )}
                  {repoAvailable === false && (
                    <p className="text-xs text-red-600 mt-1">
                      {repoCheckError}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label className="block text-sm font-medium">
                    Select Repository
                  </Label>
                  <Select
                    value={selectedRepo}
                    onValueChange={setSelectedRepo}
                    disabled={isLoadingRepos}
                  >
                    <SelectTrigger
                      className="w-full mt-1"
                      data-testid="github-repo-select"
                    >
                      <SelectValue
                        placeholder={
                          isLoadingRepos
                            ? "Loading repositories..."
                            : "Select a repository"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRepos.map((repo) => (
                        <SelectItem key={repo.full_name} value={repo.full_name}>
                          {repo.full_name} {repo.private && "(private)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Branch Selection */}
            <div>
              <Label className="block text-sm font-medium">Branch</Label>
              {repoSetupMode === "existing" && selectedRepo ? (
                <div className="space-y-2">
                  <Select
                    value={
                      branchInputMode === "select" ? selectedBranch : "custom"
                    }
                    onValueChange={(value) => {
                      if (value === "custom") {
                        setBranchInputMode("custom");
                        setCustomBranchName("");
                      } else {
                        setBranchInputMode("select");
                        setSelectedBranch(value);
                      }
                    }}
                    disabled={isLoadingBranches}
                  >
                    <SelectTrigger
                      className="w-full mt-1"
                      data-testid="github-branch-select"
                    >
                      <SelectValue
                        placeholder={
                          isLoadingBranches
                            ? "Loading branches..."
                            : "Select a branch"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBranches.map((branch) => (
                        <SelectItem key={branch.name} value={branch.name}>
                          {branch.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">
                        <span className="font-medium">
                          ✏️ Type custom branch name
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {branchInputMode === "custom" && (
                    <Input
                      data-testid="github-custom-branch-input"
                      className="w-full"
                      value={customBranchName}
                      onChange={(e) => setCustomBranchName(e.target.value)}
                      placeholder="Enter branch name (e.g., feature/new-feature)"
                      disabled={isCreatingRepo}
                    />
                  )}
                </div>
              ) : (
                <Input
                  className="w-full mt-1"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  placeholder="main"
                  disabled={isCreatingRepo}
                  data-testid="github-new-repo-branch-input"
                />
              )}
            </div>

            <Button
              type="submit"
              disabled={
                isCreatingRepo ||
                (repoSetupMode === "create" &&
                  (repoAvailable === false || !repoName)) ||
                (repoSetupMode === "existing" &&
                  (!selectedRepo ||
                    !selectedBranch ||
                    (branchInputMode === "custom" && !customBranchName.trim())))
              }
            >
              {isCreatingRepo
                ? repoSetupMode === "create"
                  ? "Creating..."
                  : "Connecting..."
                : repoSetupMode === "create"
                  ? "Create Repo"
                  : "Connect to Repo"}
            </Button>
          </form>

          {createRepoError && (
            <div className="mt-2">
              <p className="text-red-600">{createRepoError}</p>
              {(createRepoError.includes("rejected") ||
                createRepoError.includes("non-fast-forward")) && (
                <ForcePushButton onClick={() => setShowForceDialog(true)} />
              )}
            </div>
          )}
          {createRepoSuccess && (
            <p className="text-green-600 mt-2">
              {repoSetupMode === "create"
                ? "Repository created and linked!"
                : "Connected to repository!"}
            </p>
          )}
        </div>
      </div>

      {/* Force Push Warning Dialog */}
      <ForcePushDialog
        open={showForceDialog}
        onOpenChange={setShowForceDialog}
        onConfirm={() => handleSetupRepo(undefined, true)}
        isProcessing={isCreatingRepo}
      /></div>
  );
}

export function GitHubConnector({
  appId,
  folderName,
  expanded,
}: GitHubConnectorProps) {
  const { app, refreshApp } = useLoadApp(appId);
  const { settings, refreshSettings } = useSettings();
  const [pendingAutoSync, setPendingAutoSync] = useState(false);

  const handleRepoSetupComplete = useCallback(() => {
    setPendingAutoSync(true);
  }, []);

  const handleAutoSyncComplete = useCallback(() => {
    setPendingAutoSync(false);
  }, []);

  if (app?.githubOrg && app?.githubRepo && appId) {
    return (
      <ConnectedGitHubConnector
        appId={appId}
        app={app}
        refreshApp={refreshApp}
        triggerAutoSync={pendingAutoSync}
        onAutoSyncComplete={handleAutoSyncComplete}
      />
    );
  } else {
    return (
      <UnconnectedGitHubConnector
        appId={appId}
        folderName={folderName}
        settings={settings}
        refreshSettings={refreshSettings}
        handleRepoSetupComplete={handleRepoSetupComplete}
        refreshApp={refreshApp}
        expanded={expanded}
      />
    );
  }
}
