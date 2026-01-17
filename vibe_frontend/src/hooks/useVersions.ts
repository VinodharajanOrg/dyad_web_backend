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
          id: commit.hash,
          message: commit.message,
          author: commit.author,
          date: commit.date,
          hash: commit.hash,
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
      const ipcClient = IpcClient.getInstance();
      if (!ipcClient) {
        throw new Error("Version control not available in web mode");
      }
      return (ipcClient as any).revertVersion({
        appId: currentAppId,
        previousVersionId: versionId,
      });
    },
    onSuccess: async (result) => {
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
