"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { useSettings, useSettingsMutations } from "@/hooks/useSettings";
import { useLanguageModelProviders } from "@/hooks/useLanguageModelProviders";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {} from "@/components/ui/accordion";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { showError } from "@/lib/toast";
import { AzureProviderSetting, VertexProviderSetting } from "@/lib/schemas";

import { ProviderSettingsHeader } from "./ProviderSettingsHeader";
import { ApiKeyConfiguration } from "./ApiKeyConfiguration";
import { ModelsSection } from "./ModelsSection";

interface ProviderSettingsPageProps {
  provider: string;
}

export function ProviderSettingsPage({ provider }: ProviderSettingsPageProps) {
  const {
    settings,
    envVars,
    loading: settingsLoading,
    error: settingsError,
    updateSettings,
  } = useSettings();

  // Fetch all providers
  const {
    data: allProviders,
    isLoading: providersLoading,
    error: providersError,
  } = useLanguageModelProviders();

  // Settings mutations with automatic cache invalidation
  const { updateApiKey, isUpdatingApiKey, deleteApiKey, isDeletingApiKey } =
    useSettingsMutations();

  // Find the specific provider data from the fetched list
  const providerData = allProviders?.find(
    (p) => p.name?.toLowerCase() === provider.toLowerCase(),
  );

  useEffect(() => {
    const layoutMainContentContainer = document.getElementById(
      "layout-main-content-container",
    );
    if (layoutMainContentContainer) {
      layoutMainContentContainer.scrollTo(0, 0);
    }
  }, [providerData?.id]);

  const supportsCustomModels =
    providerData?.type === "custom" ||
    providerData?.type === "cloud" ||
    providerData?.type === "builtin" ||
    !providerData;

  const isDyad = provider === "auto";

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [saveError, setSaveError] = useState<string | undefined>(undefined);
  const router = useRouter();

  // Use fetched data (or defaults for Dyad)
  const providerDisplayName = isDyad
    ? "Dyad"
    : (providerData?.name ?? "Unknown Provider");
  const providerWebsiteUrl = isDyad
    ? "https://academy.dyad.sh/settings"
    : undefined; // websiteUrl not provided by backend API
  const hasFreeTier = false; // Not provided by backend API
  const envVarName = isDyad
    ? undefined
    : (providerData?.envVarName ?? undefined);

  // Get API key from settings - check both the new flat apiKeys structure and nested structure for backward compatibility
  const userApiKey =
    (settings as any)?.apiKeys?.[provider.toLowerCase()] ||
    settings?.providerSettings?.[provider.toLowerCase()]?.apiKey?.value;

  // --- Configuration Logic --- Updated Priority ---
  const isValidUserKey =
    !!userApiKey &&
    !userApiKey.startsWith("Invalid Key") &&
    userApiKey !== "Not Set";
  const hasEnvKey = !!(envVarName && envVars[envVarName]);

  const azureSettings = settings?.providerSettings?.azure as
    | AzureProviderSetting
    | undefined;
  const azureApiKeyFromSettings = (azureSettings?.apiKey?.value ?? "").trim();
  const azureResourceNameFromSettings = (
    azureSettings?.resourceName ?? ""
  ).trim();
  const azureHasSavedSettings = Boolean(
    azureApiKeyFromSettings && azureResourceNameFromSettings,
  );
  const azureHasEnvConfiguration = Boolean(
    envVars["AZURE_API_KEY"] && envVars["AZURE_RESOURCE_NAME"],
  );

  const vertexSettings = settings?.providerSettings?.vertex as
    | VertexProviderSetting
    | undefined;
  const isVertexConfigured = Boolean(
    vertexSettings?.projectId &&
    vertexSettings?.location &&
    vertexSettings?.serviceAccountKey?.value,
  );

  const isAzureConfigured =
    provider === "azure"
      ? azureHasSavedSettings || azureHasEnvConfiguration
      : false;

  const isConfigured =
    provider === "azure"
      ? isAzureConfigured
      : provider === "vertex"
        ? isVertexConfigured
        : isValidUserKey || hasEnvKey; // Configured if either is set

  // --- Save Handler ---
  const handleSaveKey = async (value: string) => {
    if (!value.trim()) {
      setSaveError("API Key cannot be empty.");
      return;
    }
    setSaveError(undefined);
    try {
      await updateApiKey({
        providerName: provider,
        apiKey: value,
      });
      setApiKeyInput(""); // Clear input on success
    } catch (error: any) {
      console.error("Error saving API key:", error);
      setSaveError(error.message || "Failed to save API key.");
    }
  };

  // --- Delete Handler ---
  const handleDeleteKey = async () => {
    setSaveError(undefined);
    try {
      await deleteApiKey(provider);
    } catch (error: any) {
      console.error("Error deleting API key:", error);
      setSaveError(error.message || "Failed to delete API key.");
    }
  };

  // --- Toggle Dyad Pro Handler ---
  const handleToggleDyadPro = async (enabled: boolean) => {
    try {
      await updateSettings({
        enableDyadPro: enabled,
      });
    } catch (error: any) {
      showError(`Error toggling Dyad Pro: ${error}`);
    }
  };

  // Effect to clear input error when input changes
  useEffect(() => {
    if (saveError) {
      setSaveError(undefined);
    }
  }, [apiKeyInput]);

  // --- Loading State for Providers ---
  if (providersLoading || settingsLoading) {
    return (
      <div className="min-h-screen px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-8 w-24 mb-4" />
          <Skeleton className="h-10 w-1/2 mb-6" />
          <Skeleton className="h-10 w-48 mb-4" />
          <div className="space-y-4 mt-6">
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // --- Error State for Settings (show warning but continue) ---
  const settingsWarning = settingsError ? (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Settings Load Error</AlertTitle>
      <AlertDescription>
        Could not load user settings: {settingsError.message}. Some features may be limited.
      </AlertDescription>
    </Alert>
  ) : null;

  // --- Error State for Providers ---
  if (providersError) {
    return (
      <div className="min-h-screen px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 mb-4 bg-(--background-lightest) py-5"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mr-3 mb-6">
            Configure Provider
          </h1>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Provider Details</AlertTitle>
            <AlertDescription>
              Could not load provider data: {providersError.message}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Handle case where provider is not found (e.g., invalid ID in URL)
  if (!providerData && !isDyad) {
    return (
      <div className="min-h-screen px-8 py-4">
        <div className="max-w-4xl mx-auto">
          <Button
            onClick={() => router.back()}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 mb-4 bg-(--background-lightest) py-5"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mr-3 mb-6">
            Provider Not Found
          </h1>
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              The provider "{provider}" could not be found.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-8 py-4">
      <div className="max-w-4xl mx-auto">
        <ProviderSettingsHeader
          providerDisplayName={providerDisplayName}
          isConfigured={isConfigured}
          isLoading={false}
          hasFreeTier={hasFreeTier}
          providerWebsiteUrl={providerWebsiteUrl}
          isDyad={isDyad}
          onBackClick={() => router.back()}
        />

        {settingsError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error Loading Settings</AlertTitle>
            <AlertDescription>
              Could not load configuration data: {settingsError.message}. You can still view provider information, but configuration changes may not be available.
            </AlertDescription>
          </Alert>
        )}

        {!settingsError && (
          <ApiKeyConfiguration
            provider={provider}
            providerDisplayName={providerDisplayName}
            settings={settings}
            envVars={envVars}
            envVarName={envVarName}
            isSaving={isUpdatingApiKey || isDeletingApiKey}
            saveError={saveError}
            apiKeyInput={apiKeyInput}
            onApiKeyInputChange={setApiKeyInput}
            onSaveKey={handleSaveKey}
            onDeleteKey={handleDeleteKey}
            isDyad={isDyad}
            updateSettings={updateSettings}
          />
        )}

        {isDyad && !settingsError && (
          <div className="mt-6 flex items-center justify-between p-4 bg-(--background-lightest) rounded-lg border">
            <div>
              <h3 className="font-medium">Enable Dyad Pro</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Toggle to enable Dyad Pro
              </p>
            </div>
            <Switch
              checked={settings?.enableDyadPro}
              onCheckedChange={handleToggleDyadPro}
              disabled={isUpdatingApiKey || isDeletingApiKey}
            />
          </div>
        )}

        {/* Conditionally render ModelsSection for all provider types */}
        {supportsCustomModels && providerData && (
          <ModelsSection providerId={String(providerData.id)} />
        )}
        <div className="h-24"></div>
      </div>
    </div>
  );
}
