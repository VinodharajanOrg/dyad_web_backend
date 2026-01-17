import { useQuery } from "@tanstack/react-query";
import { gitApi, type BranchResult } from "@/api/endpoints/git";
import { IpcClient } from "@/api/ipc_client";

export function useCurrentBranch(appId: number | null) {
  const {
    data: branchInfo,
    isLoading,
    refetch: refetchBranchInfo,
  } = useQuery<BranchResult, Error>({
    queryKey: ["currentBranch", appId],
    queryFn: async (): Promise<BranchResult> => {
      if (appId === null) {
        throw new Error("appId is null, cannot fetch current branch.");
      }

      try {
        return await gitApi.getCurrentBranch(appId);
      } catch (restError) {
        // Fallback to IPC if REST API not implemented
        console.warn(
          "Git REST API not available, falling back to IPC:",
          restError,
        );
        const ipcClient = IpcClient.getInstance();
        if (!ipcClient) {
          return { branch: null, hasGit: false };
        }
        return (ipcClient as any).getCurrentBranch(appId);
      }
    },
    enabled: appId !== null,
    meta: { showErrorToast: false },
  });

  return {
    branchInfo,
    isLoading,
    refetchBranchInfo,
  };
}
