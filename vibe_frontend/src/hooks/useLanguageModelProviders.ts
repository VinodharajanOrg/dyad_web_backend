import { useQuery } from "@tanstack/react-query";
import type { Provider } from "@/api/endpoints/language-model-providers";
import { languageModelProvidersApi } from "@/api/endpoints/language-model-providers";
import {
  cloudProviders,
  VertexProviderSetting,
  AzureProviderSetting,
} from "@/lib/schemas";
import { useSettings } from "./useSettings";
import { STALE_TIME, GC_TIME } from "@/lib/constants";

export type ProviderWithUI = Provider & { type: string; hasFreeTier: boolean };

export function useLanguageModelProviders() {
  const { settings, envVars } = useSettings();

  // Fetch available providers - this query should NOT depend on settings changes
  // since providers list is static and doesn't change based on settings
  const providersQuery = useQuery<ProviderWithUI[], Error>({
    queryKey: ["languageModelProviders"],
    queryFn: async () => {
      const providers = await languageModelProvidersApi.list();

      return providers.map((provider: Provider) => ({
        ...provider,
        type: "builtin",
        hasFreeTier: false,
      })) as ProviderWithUI[];
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch when network reconnects
  });

  // Memoize the check function to prevent unnecessary dependencies
  const isProviderSetup = (providerName: string): boolean => {
    // If settings are still loading, return false
    if (!settings) {
      return false;
    }

    const normalizedProviderName = providerName.toLowerCase();

    // Vertex uses service account credentials instead of an API key
    if (normalizedProviderName === "vertex") {
      const vertexSettings = settings?.providerSettings?.[
        normalizedProviderName
      ] as VertexProviderSetting;
      if (
        vertexSettings?.serviceAccountKey?.value &&
        vertexSettings?.projectId &&
        vertexSettings?.location
      ) {
        return true;
      }
      return false;
    }

    // Azure uses apiKey and resourceName
    if (normalizedProviderName === "azure") {
      const azureSettings = settings?.providerSettings?.[
        normalizedProviderName
      ] as AzureProviderSetting;
      const hasSavedSettings = Boolean(
        (azureSettings?.apiKey?.value ?? "").trim() &&
        (azureSettings?.resourceName ?? "").trim(),
      );
      if (hasSavedSettings) {
        return true;
      }
      // Check environment variables
      if (envVars["AZURE_API_KEY"] && envVars["AZURE_RESOURCE_NAME"]) {
        return true;
      }
      return false;
    }

    // For standard providers, check apiKeys in user settings
    const apiKeys = (settings as any)?.apiKeys;
    const hasApiKey = apiKeys?.[normalizedProviderName];

    return !!hasApiKey;
  };

  const isAnyProviderSetup = () => {
    return cloudProviders.some((provider) => isProviderSetup(provider));
  };

  return {
    data: providersQuery.data,
    isLoading: providersQuery.isLoading,
    error: providersQuery.error,
    isError: providersQuery.isError,
    refetch: async () => {
      return providersQuery.refetch();
    },
    isProviderSetup,
    isAnyProviderSetup,
    userSettings: settings,
  };
}
