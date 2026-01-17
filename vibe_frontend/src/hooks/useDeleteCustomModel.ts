import { useMutation, useQueryClient } from "@tanstack/react-query";
import { languageModelsApi } from "@/api/endpoints/language-models";

export function useDeleteCustomModel({
  providerId,
  onSuccess,
  onError,
}: {
  providerId?: string | number;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, number>({
    mutationFn: async (modelId: number) => {
      if (!modelId) {
        throw new Error("Model ID is required for deletion.");
      }
      await languageModelsApi.delete(modelId);
    },
    onSuccess: () => {
      // Invalidate queries related to language models for this specific provider
      if (providerId) {
        queryClient.invalidateQueries({
          queryKey: ["language-models", providerId],
        });
      } else {
        // Fallback: invalidate all language-models queries
        queryClient.invalidateQueries({
          queryKey: ["language-models"],
        });
      }
      // Invalidate ModelPicker's language-models-by-providers cache
      queryClient.invalidateQueries({
        queryKey: ["language-models-by-providers"],
      });
      // Invalidate general model list if needed
      queryClient.invalidateQueries({ queryKey: ["languageModels"] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      console.error("Error deleting model:", error);
      onError?.(error);
    },
    meta: {
      // Optional: for global error handling like toasts
      showErrorToast: true,
    },
  });

  return mutation;
}
