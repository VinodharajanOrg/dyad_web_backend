import { useQuery } from "@tanstack/react-query";
import { IpcClient } from "@/api/ipc_client";
import type { UserBudgetInfo } from "@/types/ipc_types";
import { STALE_TIME } from "@/lib/constants";

export function useUserBudgetInfo() {
  const queryKey = ["userBudgetInfo"];

  const { data, isLoading, error, isFetching, refetch } = useQuery<
    UserBudgetInfo | null,
    Error,
    UserBudgetInfo | null
  >({
    queryKey: queryKey,
    queryFn: async () => {
      const ipcClient = IpcClient.getInstance();
      if (!ipcClient) throw new Error("IPC client is not available");
      return ipcClient!.getUserBudget();
    },
    // This data is not critical and can be stale for a bit
    staleTime: STALE_TIME,
    // If an error occurs (e.g. API key not set), it returns null.
    // We don't want react-query to retry automatically in such cases as it's not a transient network error.
    retry: false,
  });

  return {
    userBudget: data,
    isLoadingUserBudget: isLoading,
    userBudgetError: error,
    isFetchingUserBudget: isFetching,
    refetchUserBudget: refetch,
  };
}
