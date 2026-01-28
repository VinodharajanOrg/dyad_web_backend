import { useMutation, useQueryClient } from "@tanstack/react-query";
import { gitApi } from "@/api/endpoints/git";
import { showSuccess, showError } from "@/lib/toast";

/**
 * Hook to disconnect GitHub account completely
 * This removes GitHub authentication and clears all repo connections from all apps
 */
export function useDisconnectGitHub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await gitApi.disconnectGitHub();
    },
    onSuccess: () => {
      showSuccess("Successfully disconnected from GitHub");
      
      // Invalidate git connection status query to hide integrations section
      queryClient.invalidateQueries({ queryKey: ["git", "connectionStatus"] });
      
      // After successful disconnect, update the cached app data for ALL apps to remove GitHub config
      // This is because GitHub authentication is global - disconnecting affects all apps
      queryClient.setQueriesData(
        { queryKey: ["app"] },
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
    },
    onError: (err: any) => {
      console.error("Disconnect error:", err);
      const errorMessage = 
        err?.response?.data?.message || 
        err?.response?.data?.error || 
        err?.message || 
        "An error occurred while disconnecting from GitHub";
      showError(errorMessage);
    },
  });
}
