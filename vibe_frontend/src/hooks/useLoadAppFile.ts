import { useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "@/api/endpoints/files";

export function useLoadAppFile(appId: number | null, filePath: string | null) {
  const queryClient = useQueryClient();

  const {
    data: content = null,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["appFile", appId, filePath],
    queryFn: async () => {
      if (appId === null || filePath === null) {
        return null;
      }
      return await filesApi.readFile(appId, filePath);
    },
    enabled: appId !== null && filePath !== null,
    retry: false,
  });

  const refreshFile = async () => {
    if (appId === null || filePath === null) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: ["appFile", appId, filePath],
    });
  };

  // Transform error to match original interface
  let transformedError: Error | null = null;
  if (error) {
    let errorMessage = error instanceof Error ? error.message : String(error);
    const axiosError = error as any;
    if (axiosError?.response?.status === 404) {
      errorMessage = `File not found: ${filePath}. The file may not exist in the app directory.`;
    }
    transformedError = new Error(errorMessage);
  }

  return { content, loading, error: transformedError, refreshFile };
}
