import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IpcClient } from "@/api/ipc_client";
import { showError } from "@/lib/toast";
// @ts-ignore
import type { CreateAppParams, CreateAppResult } from "@/types/ipc_types";

export function useCreateApp() {
  const queryClient = useQueryClient();

  const mutation = useMutation<CreateAppResult, Error, CreateAppParams>({
    mutationFn: async (params: CreateAppParams) => {
      if (!params.name.trim()) {
        throw new Error("App name is required");
      }

      const ipcClient = IpcClient.getInstance();
      // @ts-ignore
      return (ipcClient as any).createApp(params);
    },
    onSuccess: () => {
      // Invalidate apps list to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
    onError: (error) => {
      showError(error);
    },
  });

  const createApp = async (
    params: CreateAppParams,
  ): Promise<CreateAppResult> => {
    return mutation.mutateAsync(params);
  };

  return {
    createApp,
    isCreating: mutation.isPending,
    error: mutation.error,
  };
}
