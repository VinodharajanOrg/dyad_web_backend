import { useQuery } from "@tanstack/react-query";
import { languageModelProvidersApi } from "@/api/endpoints/language-model-providers";
import type { ProviderModelData } from "@/api/endpoints/language-model-providers";
import type { LanguageModel } from "@/api/endpoints/language-models";
import { STALE_TIME, GC_TIME } from "@/lib/constants";

/**
 * Enriched model type that includes UI-specific properties
 */
export interface EnrichedLanguageModel extends LanguageModel {
  type: "builtin" | "custom";
  tag?: string;
  tagColor?: string;
  dollarSigns?: number;
}

/**
 * Fetches all available language models grouped by their provider IDs.
 * Uses a single API call to fetch all providers with their models instead of multiple calls.
 *
 * @returns TanStack Query result object for the language models organized by provider ID.
 */
export function useLanguageModelsByProviders() {
  return useQuery<Record<string, EnrichedLanguageModel[]>, Error>({
    queryKey: ["language-models-by-providers"],
    queryFn: async () => {
      try {
        // The API response is already unwrapped by apiClient.get()
        // It returns the inner object directly: { "OpenAI": {...}, "Anthropic": {...}, ... }
        const response =
          await languageModelProvidersApi.getAllProvidersWithModels();

        // Since the response is unwrapped, we don't need to access response.data
        // The response IS the data, but we need to type it properly
        const providersData: Record<string, ProviderModelData> =
          response && typeof response === "object"
            ? (response as unknown as Record<string, ProviderModelData>)
            : {};

        // Transform the response to organize models by provider ID
        const modelsByProvider: Record<string, EnrichedLanguageModel[]> = {};

        for (const [providerKey, providerData] of Object.entries(
          providersData,
        )) {
          const providerIdString = String(providerData.id);

          // Enrich models with type information
          const enrichedModels: EnrichedLanguageModel[] = (
            providerData.models || []
          ).map((model: LanguageModel) => ({
            ...model,
            type: model.customProviderId ? "custom" : "builtin",
          }));

          // Store by provider ID for use in components
          modelsByProvider[providerIdString] = enrichedModels;
        }

        return modelsByProvider;
      } catch (error) {
        console.error("Error fetching providers with models:", error);
        throw error;
      }
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch when network reconnects
  });
}
