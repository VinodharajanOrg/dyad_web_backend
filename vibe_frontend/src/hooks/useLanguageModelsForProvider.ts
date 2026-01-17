import { useQuery } from "@tanstack/react-query";
import { languageModelsApi } from "@/api/endpoints/language-models";
import type { LanguageModel } from "@/api/endpoints/language-models";
import { STALE_TIME, GC_TIME } from "@/lib/constants";

/**
 * Fetches the list of available language models for a specific provider.
 *
 * @param providerId The ID of the language model provider.
 * @returns TanStack Query result object with the provider info and language models.
 */
export function useLanguageModelsForProvider(providerId: string | undefined) {
  return useQuery<LanguageModel[], Error>({
    queryKey: ["language-models", providerId],
    queryFn: async () => {
      if (!providerId) {
        // Avoid calling API if providerId is not set
        return [];
      }
      const response = await languageModelsApi.getProviderModels(
        Number(providerId),
      );
      return response.models;
    },
    enabled: !!providerId,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch when network reconnects
  });
}
