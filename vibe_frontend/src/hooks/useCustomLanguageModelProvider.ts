import { useMutation, useQueryClient } from "@tanstack/react-query";
import { languageModelProvidersApi } from "@/api/endpoints";
// import { IpcClient } from "@/api/ipc_client";
import type { CreateProviderParams } from "@/api/endpoints/language-model-providers";
import { showError, showSuccess } from "@/lib/toast";

export function useCustomLanguageModelProvider() {
  const queryClient = useQueryClient();
  //const ipcClient = IpcClient.getInstance();

  const createProviderMutation = useMutation({
    mutationFn: async (params: CreateProviderParams) => {
      if (!params.name.trim()) {
        throw new Error("Provider name is required");
      }
      if (!params.apiBaseUrl.trim()) {
        throw new Error("API base URL is required");
      }

      return languageModelProvidersApi.create({
        name: params.name.trim(),
        apiBaseUrl: params.apiBaseUrl.trim(),
        envVarName: params.envVarName?.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      showSuccess(data.message || "Provider created successfully");
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["languageModelProviders"] });
    },
    onError: (error) => {
      showError(error);
    },
  });

  const editProviderMutation = useMutation({
    mutationFn: async (
      params: CreateProviderParams & { providerId: number },
    ) => {
      if (!params.name.trim()) {
        throw new Error("Provider name is required");
      }
      if (!params.apiBaseUrl.trim()) {
        throw new Error("API base URL is required");
      }

      const response = await languageModelProvidersApi.update(
        params.providerId,
        {
          name: params.name.trim(),
          apiBaseUrl: params.apiBaseUrl.trim(),
          envVarName: params.envVarName?.trim() || undefined,
        },
      );

      return response;
    },
    onSuccess: (data) => {
      showSuccess(data.message || "Provider updated successfully");
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ["languageModelProviders"] });
    },
    onError: (error) => {
      showError(error);
    },
  });

  const deleteProviderMutation = useMutation({
    mutationFn: async (providerId: string): Promise<void> => {
      if (!providerId) {
        throw new Error("Provider ID is required");
      }

      await languageModelProvidersApi.delete(providerId);
    },
    //onSuccess: (_, __, _context) => {
    onSuccess: (_, __) => {
      showSuccess("Provider deleted successfully");
      // Invalidate providers list
      queryClient.invalidateQueries({ queryKey: ["languageModelProviders"] });
      // Invalidate ModelPicker's language-models-by-providers cache
      queryClient.invalidateQueries({
        queryKey: ["language-models-by-providers"],
      });
    },
    onError: (error) => {
      showError(error);
    },
  });

  const createProvider = async (params: CreateProviderParams) => {
    return createProviderMutation.mutateAsync(params);
  };

  const editProvider = async (
    params: CreateProviderParams & { providerId: number },
  ) => {
    return editProviderMutation.mutateAsync(params);
  };

  const deleteProvider = async (providerId: string): Promise<void> => {
    return deleteProviderMutation.mutateAsync(providerId);
  };

  return {
    createProvider,
    editProvider,
    deleteProvider,
    isCreating: createProviderMutation.isPending,
    isEditing: editProviderMutation.isPending,
    isDeleting: deleteProviderMutation.isPending,
    error:
      createProviderMutation.error ||
      editProviderMutation.error ||
      deleteProviderMutation.error,
  };
}
