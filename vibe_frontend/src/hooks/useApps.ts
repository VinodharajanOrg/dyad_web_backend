import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  appsApi,
  type CreateAppParams,
  type UpdateAppParams,
  type CopyAppParams,
} from "@/api/endpoints/apps";
import { toast } from "sonner";
import { STALE_TIME, GC_TIME } from "@/lib/constants";

/**
 * Query key factory for apps
 */
export const appsKeys = {
  all: ["apps"] as const,
  lists: () => [...appsKeys.all, "list"] as const,
  list: () => [...appsKeys.lists()] as const,
  details: () => [...appsKeys.all, "detail"] as const,
  detail: (id: number) => [...appsKeys.details(), id] as const,
};

/**
 * Hook to fetch all apps
 * Caches for 5 minutes. Invalidated on create/update/delete operations.
 */
export function useApps() {
  return useQuery({
    queryKey: appsKeys.list(),
    queryFn: async () => {
      const result = await appsApi.list();
      const apps = Array.isArray(result) ? result : result.apps || [];
      return apps;
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });
}

/**
 * Hook to fetch a single app
 */
export function useApp(appId: number) {
  return useQuery({
    queryKey: appsKeys.detail(appId),
    queryFn: () => appsApi.get(appId),
    enabled: !!appId,
  });
}

/**
 * Hook to create a new app
 */
export function useCreateApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateAppParams) => appsApi.create(params),
    onSuccess: (newApp) => {
      // Invalidate and refetch apps list
      queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
      toast.success(`App "${newApp.name}" created successfully!`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create app");
    },
  });
}

/**
 * Hook to update an app
 */
export function useUpdateApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      appId,
      params,
    }: {
      appId: number;
      params: UpdateAppParams;
    }) => appsApi.update(appId, params),
    onSuccess: (updatedApp) => {
      // Invalidate specific app and list
      queryClient.invalidateQueries({
        queryKey: appsKeys.detail(updatedApp.id),
      });
      queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
      toast.success("App updated successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update app");
    },
  });
}

/**
 * Hook to delete an app
 */
export function useDeleteApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: number) => appsApi.delete(appId),
    onSuccess: (_, appId) => {
      // Remove from cache and refetch list
      queryClient.removeQueries({ queryKey: appsKeys.detail(appId) });
      queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
      toast.success("App deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete app");
    },
  });
}

/**
 * Hook to copy an app
 */
export function useCopyApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, params }: { appId: number; params: CopyAppParams }) =>
      appsApi.copy(appId, params),
    onSuccess: (copiedApp) => {
      // Refetch apps list
      queryClient.invalidateQueries({ queryKey: appsKeys.lists() });
      toast.success(`App copied as "${copiedApp.name}"!`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to copy app");
    },
  });
}

/**
 * Hook to toggle favorite status
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appId: number) => appsApi.toggleFavorite(appId),
    onSuccess: (updatedApp) => {
      // Update cache optimistically
      queryClient.setQueryData(appsKeys.detail(updatedApp.id), updatedApp);
      queryClient.invalidateQueries({ queryKey: appsKeys.lists() });

      const message = updatedApp.isFavorite
        ? "Added to favorites!"
        : "Removed from favorites!";
      toast.success(message);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update favorite status");
    },
  });
}
