import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showError, showSuccess } from "@/lib/toast";
import { useAtom } from "jotai";
import { appsListAtom } from "@/atoms/appAtoms";
import { appsApi } from "@/api/endpoints/apps";
import { appsKeys } from "./useApps";

export function useAddAppToFavorite() {
  const [_, setApps] = useAtom(appsListAtom);
  const queryClient = useQueryClient();

  const mutation = useMutation<boolean, Error, number>({
    mutationFn: async (appId: number): Promise<boolean> => {
      const result = await appsApi.toggleFavorite(appId);
      return result.isFavorite;
    },
    onSuccess: (newIsFavorite, appId) => {
      setApps((currentApps) =>
        currentApps.map((app) =>
          app.id === appId ? { ...app, isFavorite: newIsFavorite } : app,
        ),
      );

      // Invalidate TanStack Query cache to ensure data consistency
      queryClient.invalidateQueries({ queryKey: appsKeys.lists() });

      showSuccess("App favorite status updated");
    },
    onError: (error) => {
      showError(error.message || "Failed to update favorite status");
    },
  });

  return {
    toggleFavorite: mutation.mutate,
    toggleFavoriteAsync: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
    isError: mutation.isError,
    isSuccess: mutation.isSuccess,
  };
}
