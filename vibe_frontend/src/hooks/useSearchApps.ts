import { appsApi, type App } from "@/api/endpoints/apps";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useSearchApps(query: string) {
  const enabled = Boolean(query && query.trim().length > 0);

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["search-apps", query],
    enabled,
    queryFn: async (): Promise<App[]> => {
      return appsApi.search(query);
    },
    placeholderData: keepPreviousData,
    retry: 0,
  });

  return {
    apps: data ?? [],
    loading: enabled ? isFetching || isLoading : false,
  };
}
