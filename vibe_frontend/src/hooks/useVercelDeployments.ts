import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IpcClient } from "@/api/ipc_client";
// @ts-ignore
import { VercelDeployment } from "@/types/ipc_types";

export function useVercelDeployments(appId: number) {
  const queryClient = useQueryClient();

  const {
    data: deployments = [],
    isLoading,
    error,
    refetch,
  } = useQuery<VercelDeployment[], Error>({
    queryKey: ["vercel-deployments", appId],
    queryFn: async () => {
      const ipcClient = IpcClient.getInstance();
      // @ts-ignore
      return (ipcClient as any).getVercelDeployments({ appId });
    },
    // enabled: false, // Don't auto-fetch, only fetch when explicitly requested
  });

  const disconnectProjectMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const ipcClient = IpcClient.getInstance();
      // @ts-ignore
      return (ipcClient as any).disconnectVercelProject({ appId });
    },
    onSuccess: () => {
      // Clear deployments cache when project is disconnected
      queryClient.removeQueries({ queryKey: ["vercel-deployments", appId] });
    },
  });

  const getDeployments = async () => {
    return refetch();
  };

  const disconnectProject = async () => {
    return disconnectProjectMutation.mutateAsync();
  };

  return {
    deployments,
    isLoading,
    error: error?.message || null,
    getDeployments,
    disconnectProject,
    isDisconnecting: disconnectProjectMutation.isPending,
    disconnectError: disconnectProjectMutation.error?.message || null,
  };
}
