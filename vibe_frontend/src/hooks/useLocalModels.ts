import { useCallback } from "react";
import { useAtom } from "jotai";
import {
  localModelsAtom,
  localModelsLoadingAtom,
  localModelsErrorAtom,
} from "@/atoms/localModelsAtoms";
import { IpcClient } from "@/api/ipc_client";

export function useLocalModels() {
  const [models, setModels] = useAtom(localModelsAtom);
  const [loading, setLoading] = useAtom(localModelsLoadingAtom);
  const [error, setError] = useAtom(localModelsErrorAtom);

  const ipcClient = IpcClient.getInstance();

  /**
   * Load local models from Ollama
   */
  const loadModels = useCallback(async () => {
    setLoading(true);
    try {
      if (!ipcClient) {
        console.warn("IPC not available — skipping local model load.");
        setModels([]); // No models available
        setError(null); // No actual error
        return [];
      }

      // @ts-ignore
      const modelList = await ipcClient.listLocalOllamaModels();
      setModels(modelList);
      setError(null);

      return modelList;
    } catch (error) {
      console.error("Error loading local Ollama models:", error);
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
