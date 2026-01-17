import { useQuery } from "@tanstack/react-query";
import { IpcClient } from "@/api/ipc_client";

export const useCheckName = (appName: string) => {
  return useQuery({
    queryKey: ["checkAppName", appName],
    queryFn: async () => {
      const ipcClient = IpcClient.getInstance();
      if (!ipcClient) throw new Error("IPC client is not available");
      const result = await ipcClient!.checkAppName({ appName });
      return result;
    },
    enabled: !!appName && !!appName.trim(),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    retry: false,
    staleTime: 300000, // 5 minutes
  });
};
