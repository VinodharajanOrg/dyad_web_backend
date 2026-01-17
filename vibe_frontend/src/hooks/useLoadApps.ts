import { useEffect } from "react";
import { useAtom } from "jotai";
import { appBasePathAtom, appsListAtom } from "@/atoms/appAtoms";
import { useApps } from "./useApps";

// All components using useLoadApps now share the same cached data
export function useLoadApps() {
  const [, setApps] = useAtom(appsListAtom);
  const [, setAppBasePath] = useAtom(appBasePathAtom);

  // Use TanStack Query hook from useApps
  const { data: appsData, isLoading, error, refetch } = useApps();

  // Sync TanStack Query data with Jotai atoms (for backward compatibility)
  useEffect(() => {
    if (appsData) {
      setApps(appsData as any);
      // TODO: Backend should return appBasePath
      setAppBasePath("/tmp/dyad-apps"); // Temporary fallback
    }
  }, [appsData, setApps, setAppBasePath]);

  // Ensure apps is always an array
  return {
    apps: appsData || [],
    loading: isLoading,
    error: error as Error | null,
    refreshApps: refetch,
  };
}
