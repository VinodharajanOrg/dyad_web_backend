import { useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { dockerApi } from "@/api/endpoints/docker";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import { useRef, useEffect } from "react";
import { POLLING_STATUS_API, MAX_POLLING_STATUS_API } from "@/lib/constants";

/**
 * Hook to get Docker status for a specific app
 * - Only polls when preview panel is visible
 * - Stops polling once app is ready and running
 */
export function useDockerStatus(appId: number | null) {
  const isPreviewOpen = useAtomValue(isPreviewOpenAtom);
  const isReadyRef = useRef(false);
  const pollingStartTimeRef = useRef<number | null>(null);

  // Update ref when data arrives - once isReady AND isRunning are true, stop polling
  const query = useQuery({
    queryKey: ["docker-status", appId],
    queryFn: async () => {
      if (!appId) throw new Error("App ID is required");
      const status = await dockerApi.getDockerStatus(appId);
      return status;
    },
    enabled: appId !== null && isPreviewOpen,
    refetchInterval: (query) => {
      // Initialize polling start time on first poll
      if (pollingStartTimeRef.current === null) {
        pollingStartTimeRef.current = Date.now();
      }

      // Stop polling if max polling duration exceeded (2 minutes)
      const elapsedTime = Date.now() - pollingStartTimeRef.current;
      if (elapsedTime > MAX_POLLING_STATUS_API) {
        return false; // Stop polling after 2 minutes
      }

      // Stop polling if both isReady and isRunning are true
      if (query.state.data?.isReady && query.state.data?.isRunning) {
        isReadyRef.current = true;
        return false; // Disable refetching
      }
      return POLLING_STATUS_API; // Poll every 5 seconds
    },
    retry: 1,
  });

  // Reset ready status and polling timer when app or preview state changes
  useEffect(() => {
    isReadyRef.current = false;
    pollingStartTimeRef.current = null;
  }, [appId, isPreviewOpen]);

  const isPublishEnabled =
    query.data?.isReady && query.data?.isRunning && query.data?.port;

  return {
    dockerStatus: query.data,
    isLoadingStatus: query.isLoading,
    isPublishEnabled,
    ...query,
  };
}
