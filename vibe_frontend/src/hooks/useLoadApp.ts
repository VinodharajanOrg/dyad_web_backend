import { useEffect } from "react";
import { useQuery, QueryClient } from "@tanstack/react-query";
import { appsApi, filesApi } from "@/api";
import { useAtom, useAtomValue } from "jotai";
import { currentAppAtom } from "@/atoms/appAtoms";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import { App } from "@/api/endpoints/apps";
import { GC_TIME, STALE_TIME } from "@/lib/constants";
import { usePathname } from "next/navigation";

export function useLoadApp(appId: number | null) {
  const [, setApp] = useAtom(currentAppAtom);
  const isPreviewOpen = useAtomValue(isPreviewOpenAtom);
  const pathname = usePathname();

  const {
    data: appData,
    isLoading: loading,
    error,
    refetch: refreshApp,
  } = useQuery<App | null, Error>({
    queryKey: ["app", appId],
    queryFn: async () => {
      if (appId === null) {
        return null;
      }
      const app = await appsApi.get(appId);

      // NOTE: WORKAROUND - Backend doesn't populate files, fetch them separately
      // Only fetch file tree if preview panel is visible
      if (!app.files || app.files.length === 0) {
        try {
          // Recursively get all file paths
          const allFiles: string[] = [];

          const collectFiles = async (dirPath: string = "") => {
            const items = await filesApi.listFiles(appId, dirPath);

            for (const item of items) {
              const itemPath = dirPath ? `${dirPath}/${item.name}` : item.name;
              if (item.isDirectory) {
                // Recursively collect files from subdirectories
                await collectFiles(itemPath);
              } else {
                allFiles.push(itemPath);
              }
            }
          };

          await collectFiles("");
          app.files = allFiles;
        } catch {
          app.files = [];
        }
      }

      return app;
    },
    // Only fetch when on chat route, preview is open, and appId exists
    // Check pathname matches appId to prevent fetching during navigation
    enabled:
      appId !== null &&
      isPreviewOpen &&
      pathname.includes("/chat") &&
      pathname.includes(`/${appId}/`),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    // Deliberately not showing error toast here because
    // this will pop up when app is deleted.
    // meta: { showErrorToast: true },
  });

  useEffect(() => {
    if (appId === null) {
      setApp(null);
    } else if (appData !== undefined) {
      setApp(appData as any); // TODO: Align types
    }
  }, [appId, appData, setApp]);

  return { app: appData, loading, error, refreshApp };
}

// Function to invalidate and refetch the app query
export const invalidateAppQuery = async (
  queryClient: QueryClient,
  { appId }: { appId: number | null },
) => {
  // First, remove the cached data completely
  queryClient.removeQueries({ queryKey: ["app", appId] });

  // Then refetch to get fresh data
  await queryClient.refetchQueries({ queryKey: ["app", appId] });
};
