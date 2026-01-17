import { useQuery } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { authApi } from "@/api/endpoints/auth";
import { userInfoAtom } from "@/atoms/userAtoms";
import { useEffect } from "react";
import { STALE_TIME } from "@/lib/constants";

interface UseUserInfoOptions {
  enabled?: boolean;
}

/**
 * Hook to fetch and manage user info in global store
 * Automatically updates userInfoAtom when data is fetched
 * Returns user info, loading state, error, and refetch function
 */
export function useUserInfo(options: UseUserInfoOptions = {}) {
  const { enabled = true } = options;
  const setUserInfo = useSetAtom(userInfoAtom);

  const query = useQuery({
    queryKey: ["userInfo"],
    queryFn: async () => {
      const data = await authApi.getUserInfo();
      return data;
    },
    enabled,
    retry: false,
    staleTime: STALE_TIME,
  });

  // Update user data in global store whenever query data changes
  useEffect(() => {
    if (query.data) {
      setUserInfo(query.data);
    }
  }, [query.data, setUserInfo]);

  return {
    userInfo: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
