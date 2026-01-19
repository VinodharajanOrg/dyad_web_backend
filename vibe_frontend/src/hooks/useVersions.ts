import { useEffect } from "react";
import { useAtom /*, useAtomValue, useSetAtom */ } from "jotai";
import { versionsListAtom } from "@/atoms/appAtoms";
import { gitApi } from "@/api/endpoints/git";
import { IpcClient } from "@/api/ipc_client";
 
// import { chatMessagesByIdAtom, selectedChatIdAtom } from "@/atoms/chatAtoms";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RevertVersionResponse, Version } from "@/types/ipc_types";
import { toast } from "sonner";
 
// NOTE: Replace IPC with REST - Use Git REST API for listing versions
export function useVersions(appId: number | null) {
  const [, setVersionsAtom] = useAtom(versionsListAtom);
  //const selectedChatId = useAtomValue(selectedChatIdAtom);
  //const setMessagesById = useSetAtom(chatMessagesByIdAtom);
  const queryClient = useQueryClient();
 
  const {
    data: versions,
    isLoading: loading,
    error,
    refetch: refreshVersions,
  } = useQuery<Version[], Error>({
    queryKey: ["versions", appId],
    queryFn: async (): Promise<Version[]> => {
      if (appId === null) {
        return [];
      }
 
      try {
        const commits = await gitApi.getCommitLog(appId);
        // Map GitCommit[] to Version[]
        return commits.map((commit) => ({
          id: commit.oid || '',
          message: commit.message || '',
          author: commit.author,
          timestamp: commit.timestamp,
          oid: commit.oid || '',
          hash: commit.oid || '',
        }));
      } catch (restError) {
        // Fallback to IPC if REST API not implemented
        console.warn(
          "Git REST API not available, falling back to IPC:",
          restError,
        );
        const ipcClient = IpcClient.getInstance();
        if (!ipcClient) {
          return [];
        }
        return (ipcClient as any).listVersions({ appId });
      }
    },
    enabled: appId !== null,
    initialData: [],
    meta: { showErrorToast: false }, // Don't show error toast, we have fallback
  });
 
  useEffect(() => {
    if (versions) {
      setVersionsAtom(versions);
    }
  }, [versions, setVersionsAtom]);
 
  const revertVersionMutation = useMutation<
    RevertVersionResponse,
    Error,
    { versionId: string }
  >({
    mutationFn: async ({ versionId }: { versionId: string }) => {
      const currentAppId = appId;
      if (currentAppId === null) {
        throw new Error("App ID is null");
      }
      
      try {
        // Call the revert API which creates a new commit with the target version's state
        const result = await gitApi.revert({
          appId: currentAppId,
          versionId: versionId,
        });
        
        // NOTE: Check if result indicates failure or cancellation
        if (!result || !result.newSha) {
          throw new Error("Revert operation failed or was cancelled");
        }
        
        // Find the version number for the success message
        const targetVersion = versions.find(v => v.oid === versionId || v.hash === versionId);
        const versionIndex = versions.findIndex(v => v.oid === versionId || v.hash === versionId);
        const versionNumber = versionIndex >= 0 ? versions.length - versionIndex : '?';
        
        return {
          successMessage: `Reverted all changes back to version ${versionNumber}`,
          newSha: result.newSha,
        } as RevertVersionResponse;
      } catch (restError: any) {
        // NOTE: Don't show fallback for cancellation or abort errors
        if (restError?.name === 'AbortError' || restError?.message?.includes('cancel')) {
          throw new Error("Revert operation was cancelled");
        }
        
        // Fallback to IPC if REST API not implemented (for Electron mode)
        console.warn(
          "Git REST API not available, falling back to IPC:",
          restError,
        );
        const ipcClient = IpcClient.getInstance();
        if (!ipcClient) {
          throw new Error("Version control not available");
        }
        return (ipcClient as any).revertVersion({
          appId: currentAppId,
          previousVersionId: versionId,
        });
      }
    },
    onSuccess: async (result) => {
      // NOTE: Only show success and refresh if result is valid
      if (!result || (!result.successMessage && !result.warningMessage)) {
        console.warn("Revert completed but no status message received");
        return;
      }
      
      if ("successMessage" in result) {
        toast.success(result.successMessage);
      } else if ("warningMessage" in result) {
        toast.warning(result.warningMessage);
      }
      await queryClient.invalidateQueries({ queryKey: ["versions", appId] });
      await queryClient.invalidateQueries({
        queryKey: ["currentBranch", appId],
      });
      // NOTE: Refresh chat messages for the selected chat to reflect any changes
      // if (selectedChatId) {
      //   const ipcClient = IpcClient.getInstance();
      //   if (ipcClient) {
      //     const chat = await (ipcClient as any).getChat(selectedChatId);
      //     setMessagesById((prev) => {
      //       const next = new Map(prev);
      //       next.set(selectedChatId, chat.messages);
      //       return next;
      //     });
      //   }
      // }
      await queryClient.invalidateQueries({
        queryKey: ["problems", appId],
      });
    },
    onError: async (error: Error) => {
      // NOTE: Don't refresh versions list if operation failed/cancelled
      console.error("Revert operation failed:", error);
      
      // Only show error toast for non-cancellation errors
      if (!error.message?.includes('cancel')) {
        toast.error(`Failed to revert: ${error.message}`);
      }
    },
    meta: { showErrorToast: true },
  });
 
  return {
    versions: versions || [],
    loading,
    error,
    refreshVersions,
    revertVersion: revertVersionMutation.mutateAsync,
    isRevertingVersion: revertVersionMutation.isPending,
  };
}