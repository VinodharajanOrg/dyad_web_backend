import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gitApi } from "@/api/endpoints/git";
import { IpcClient } from "@/api/ipc_client";
import { useSetAtom } from "jotai";
import { activeCheckoutCounterAtom } from "@/atoms/appAtoms";

interface CheckoutVersionVariables {
  appId: number;
  versionId: string;
}

export function useCheckoutVersion() {
  const queryClient = useQueryClient();
  const setActiveCheckouts = useSetAtom(activeCheckoutCounterAtom);

  const { isPending: isCheckingOutVersion, mutateAsync: checkoutVersion } =
    useMutation<void, Error, CheckoutVersionVariables>({
      mutationFn: async ({ appId, versionId }) => {
        if (appId === null) {
          throw new Error("App ID is null, cannot checkout version.");
        }
        setActiveCheckouts((prev) => prev + 1);
        try {
          // NOTE: Replace IPC with REST - Try REST API first, fallback to IPC
          try {
            await gitApi.checkout({ appId, versionId });
          } catch (restError) {
            // Fallback to IPC if REST API not implemented
            console.warn(
              "Git REST API not available, falling back to IPC:",
              restError,
            );
            const ipcClient = IpcClient.getInstance();
            if (!ipcClient) {
              throw new Error("Version control not available");
            }
            await (ipcClient as any).checkoutVersion({ appId, versionId });
          }
        } finally {
          setActiveCheckouts((prev) => prev - 1);
        }
      },
      onSuccess: (_, variables) => {
        // Invalidate queries that depend on the current version/branch
        queryClient.invalidateQueries({
          queryKey: ["currentBranch", variables.appId],
        });
        queryClient.invalidateQueries({
          queryKey: ["versions", variables.appId],
        });
      },
      meta: { showErrorToast: true },
    });

  return {
    checkoutVersion,
    isCheckingOutVersion,
  };
}
