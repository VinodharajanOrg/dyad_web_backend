import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dockerApi, RunAppParams } from "@/api/endpoints/docker";
import { showSuccess, showError } from "@/lib/toast";

/**
 * Hook to run an app in Docker
 */
export function useRunAppInDocker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      appId,
      params,
    }: {
      appId: number;
      params?: RunAppParams;
    }) => {
      return dockerApi.runInDocker(appId, params);
    },
    onSuccess: (data, variables) => {
      showSuccess("App started successfully in Docker");
      // Invalidate queries to refresh status
      queryClient.invalidateQueries({
        queryKey: ["docker-status", variables.appId],
      });
      queryClient.invalidateQueries({ queryKey: ["docker-service-status"] });
    },
    onError: (error: any, variables) => {
      const errorMessage =
        error?.response?.data?.error || error?.message || "Unknown error";
      showError(`Failed to start app ${variables.appId}: ${errorMessage}`);
    },
  });
}

/**
 * Hook to stop a Docker app
 */
export function useStopDockerApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appId: number) => {
      return dockerApi.stopDocker(appId);
    },
    onSuccess: (data, appId) => {
      showSuccess(data.message || "App stopped successfully");
      // Invalidate queries to refresh status
      queryClient.invalidateQueries({ queryKey: ["docker-status", appId] });
      queryClient.invalidateQueries({ queryKey: ["docker-service-status"] });
    },
    onError: (error: any, appId) => {
      const errorMessage =
        error?.response?.data?.error || error?.message || "Unknown error";
      showError(`Failed to stop app ${appId}: ${errorMessage}`);
    },
  });
}

/**
 * Hook to cleanup Docker volumes for an app
 */
export function useCleanupDockerVolumes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (appId: number) => {
      return dockerApi.cleanupDocker(appId);
    },
    onSuccess: (data, appId) => {
      showSuccess(data.message || "Docker volumes cleaned up successfully");
      // Invalidate queries to refresh status
      queryClient.invalidateQueries({ queryKey: ["docker-status", appId] });
      queryClient.invalidateQueries({ queryKey: ["docker-service-status"] });
    },
    onError: (error: any, appId) => {
      const errorMessage =
        error?.response?.data?.error || error?.message || "Unknown error";
      showError(`Failed to cleanup volumes for app ${appId}: ${errorMessage}`);
    },
  });
}
