import { useEffect, useCallback } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { userSettingsAtom, envVarsAtom } from "@/atoms/appAtoms";
import { IpcClient } from "@/api/ipc_client";
import { settingsApi } from "@/api/endpoints/settings";
import { type UserSettings } from "@/lib/schemas";
import { usePostHog } from "posthog-js/react";
import { showSuccess, showError } from "@/lib/toast";
import { useAppVersion } from "./useAppVersion";
import { STALE_TIME, GC_TIME } from "@/lib/constants";

const TELEMETRY_CONSENT_KEY = "dyadTelemetryConsent";
const TELEMETRY_USER_ID_KEY = "dyadTelemetryUserId";
const SETTINGS_QUERY_KEY = ["userSettings", "global"];

export function isTelemetryOptedIn() {
  return window.localStorage.getItem(TELEMETRY_CONSENT_KEY) === "opted_in";
}

export function getTelemetryUserId(): string | null {
  return window.localStorage.getItem(TELEMETRY_USER_ID_KEY);
}

let isInitialLoad = false;

export function useSettings() {
  const posthog = usePostHog();
  const [settings, setSettingsAtom] = useAtom(userSettingsAtom);
  const [envVars, setEnvVarsAtom] = useAtom(envVarsAtom);
  const appVersion = useAppVersion();
  const queryClient = useQueryClient();

  // Fetch settings with 5 minute stale time
  const {
    isLoading,
    error,
    data: queryData,
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const ipcClient = IpcClient.getInstance();
      if (!ipcClient) {
        // Web mode - fetch from API
        const apiSettings = await settingsApi.getSettings();
        // Convert API response to UserSettings format
        const userSettings = {
          id: apiSettings.id,
          userId: apiSettings.userId,
          selectedModel: apiSettings.selectedModel,
          apiKeys: apiSettings.apiKeys || {},
          selectedChatMode: apiSettings.selectedChatMode,
          smartContextEnabled: apiSettings.smartContextEnabled,
          turboEditsV2Enabled: apiSettings.turboEditsV2Enabled,
          createdAt: apiSettings.createdAt,
          updatedAt: apiSettings.updatedAt,
        } as unknown as UserSettings;
        return {
          userSettings,
          envVars: {} as Record<string, string>,
        };
      }
      // Fetch settings and env vars concurrently in Electron mode
      const [userSettings, fetchedEnvVars] = await Promise.all([
        (ipcClient as any).getUserSettings(),
        (ipcClient as any).getEnvVars(),
      ]);
      return {
        userSettings,
        envVars: fetchedEnvVars,
      };
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
  });

  // Sync query data to Jotai atoms when available
  useEffect(() => {
    if (queryData) {
      processSettingsForTelemetry(queryData.userSettings);
      if (!isInitialLoad && appVersion) {
        posthog.capture("app:initial-load", {
          isPro: Boolean(
            queryData.userSettings.providerSettings?.auto?.apiKey?.value,
          ),
          appVersion,
        });
        isInitialLoad = true;
      }
      setSettingsAtom(queryData.userSettings);
      setEnvVarsAtom(queryData.envVars);
    }
  }, [queryData, setSettingsAtom, setEnvVarsAtom, appVersion]);

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      try {
        const ipcClient = IpcClient.getInstance();
        if (!ipcClient) {
          // Web mode - just update local state and refetch to get server state
          const updatedSettings = {
            ...settings,
            ...newSettings,
          } as UserSettings;
          setSettingsAtom(updatedSettings);
          // Invalidate query to refetch from server
          await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
          return updatedSettings;
        }
        const updatedSettings = await (ipcClient as any).setUserSettings(
          newSettings,
        );
        setSettingsAtom(updatedSettings);
        processSettingsForTelemetry(updatedSettings);
        // Invalidate query to refetch from server
        await queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
        return updatedSettings;
      } catch (error) {
        console.error("Error updating settings:", error);
        throw error;
      }
    },
    [settings, setSettingsAtom, queryClient],
  );

  return {
    settings,
    envVars,
    loading: isLoading,
    error: error,
    updateSettings,

    refreshSettings: () => {
      return queryClient.refetchQueries({ queryKey: SETTINGS_QUERY_KEY });
    },
  };
}

function processSettingsForTelemetry(settings: UserSettings) {
  if (settings.telemetryConsent) {
    window.localStorage.setItem(
      TELEMETRY_CONSENT_KEY,
      settings.telemetryConsent,
    );
  } else {
    window.localStorage.removeItem(TELEMETRY_CONSENT_KEY);
  }
  if (settings.telemetryUserId) {
    window.localStorage.setItem(
      TELEMETRY_USER_ID_KEY,
      settings.telemetryUserId,
    );
  } else {
    window.localStorage.removeItem(TELEMETRY_USER_ID_KEY);
  }
}

/**
 * Hook for managing settings-related mutations with automatic cache invalidation
 * Invalidates the settings cache after any mutation so fresh data is fetched
 */
export function useSettingsMutations() {
  const queryClient = useQueryClient();

  // Mutation for updating API keys
  const updateApiKeyMutation = useMutation({
    mutationFn: async ({
      providerName,
      apiKey,
    }: {
      providerName: string;
      apiKey: string;
    }) => {
      return settingsApi.updateApiKey(providerName, { apiKey });
    },
    onSuccess: () => {
      // Invalidate settings cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      showSuccess("API key saved successfully");
    },
    onError: (error: any) => {
      showError(error.message || "Failed to save API key");
    },
  });

  // Mutation for deleting API keys
  const deleteApiKeyMutation = useMutation({
    mutationFn: async (providerName: string) => {
      return settingsApi.deleteApiKey(providerName);
    },
    onSuccess: () => {
      // Invalidate settings cache to refetch updated data
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEY });
      showSuccess("API key deleted successfully");
    },
    onError: (error: any) => {
      showError(error.message || "Failed to delete API key");
    },
  });

  return {
    updateApiKey: updateApiKeyMutation.mutate,
    updateApiKeyAsync: updateApiKeyMutation.mutateAsync,
    isUpdatingApiKey: updateApiKeyMutation.isPending,

    deleteApiKey: deleteApiKeyMutation.mutate,
    deleteApiKeyAsync: deleteApiKeyMutation.mutateAsync,
    isDeletingApiKey: deleteApiKeyMutation.isPending,
  };
}
