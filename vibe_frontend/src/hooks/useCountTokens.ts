import { useCallback } from "react";
import { atom, useAtom } from "jotai";
import { IpcClient } from "@/api/ipc_client";
// @ts-ignore
import type { TokenCountResult } from "@/types/ipc_types";

// Create atoms to store the token count state
export const tokenCountResultAtom = atom<TokenCountResult | null>(null);
export const tokenCountLoadingAtom = atom<boolean>(false);
export const tokenCountErrorAtom = atom<Error | null>(null);

export function useCountTokens() {
  const [result, setResult] = useAtom(tokenCountResultAtom);
  const [loading, setLoading] = useAtom(tokenCountLoadingAtom);
  const [error, setError] = useAtom(tokenCountErrorAtom);

  const countTokens = useCallback(
    async (chatId: number, input: string) => {
      setLoading(true);
      setError(null);

      try {
        const ipcClient = IpcClient.getInstance();
        if (!ipcClient) {
          // In web mode, IpcClient is not available, skip token counting
          console.warn("[useCountTokens] IpcClient not available in web mode");
          setResult(null);
          return null;
        }
        // @ts-ignore
        const tokenResult = await ipcClient.countTokens({ chatId, input });
        setResult(tokenResult);
        return tokenResult;
      } catch (error) {
        console.error("Error counting tokens:", error);
        setError(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setResult],
  );

  return {
    countTokens,
    result,
    loading,
    error,
  };
}
