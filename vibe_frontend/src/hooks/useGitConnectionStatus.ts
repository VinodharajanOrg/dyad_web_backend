import { useQuery } from "@tanstack/react-query";
import { gitApi } from "@/api/endpoints/git";
import { STALE_TIME } from "@/lib/constants";

/**
 * Hook to check GitHub connection status
 * @returns Query result with connection status (boolean)
 */
export function useGitConnectionStatus() {
  return useQuery({
    queryKey: ["git", "connectionStatus"],
    queryFn: async () => {
      try {
        // Returns boolean: true if connected, false otherwise
        const connected = await gitApi.checkConnectionStatus();
        return connected;
      } catch (error) {
        console.error("Error checking git connection status:", error);
        return false;
      }
    },
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  });
}
