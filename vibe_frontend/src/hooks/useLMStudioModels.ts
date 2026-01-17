import { useCallback } from "react";
import { useAtom } from "jotai";
import {
  lmStudioModelsAtom,
  lmStudioModelsLoadingAtom,
  lmStudioModelsErrorAtom,
} from "@/atoms/localModelsAtoms";
import { IpcClient } from "@/api/ipc_client";

export function useLocalLMSModels() {
  const [models, setModels] = useAtom(lmStudioModelsAtom);
  const [loading, setLoading] = useAtom(lmStudioModelsLoadingAtom);
  const [error, setError] = useAtom(lmStudioModelsErrorAtom);

  const ipcClient = IpcClient.getInstance();

  /**
   * Load local models from Ollama
   */
  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      if (!ipcClient) {
        console.warn(
          "IPC not available — LM Studio models disabled in web mode.",
        );
        setModels([]);
        setError(null);
        return [];
      }

      // @ts-ignore
      const modelList = await ipcClient.listLocalLMStudioModels();
      setModels(modelList);
      setError(null);

      return modelList;
    } catch (error) {
      console.error("Error loading local LMStudio models:", error);
      setError(error instanceof Error ? error : new Error(String(error)));
      return [];
    } finally {
      setLoading(false);
    }
  }, [ipcClient, setModels, setError, setLoading]);

  return {
    models,
    loading,
    error,
    loadModels,
  };
}
