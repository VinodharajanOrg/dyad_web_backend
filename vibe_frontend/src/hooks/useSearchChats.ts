import { chatsApi } from "@/api";
import type { ChatWithMessages } from "@/api/endpoints/chats";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export function useSearchChats(query: string) {
  const enabled = Boolean(query && query.trim().length > 0);

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ["search-chats", query],
    enabled,
    queryFn: async (): Promise<ChatWithMessages[]> => {
      // Non-null assertion safe due to enabled guard
      return chatsApi.search(query);
    },
    placeholderData: keepPreviousData,
    retry: 0,
  });

  return {
    chats: data ?? [],
    loading: enabled ? isFetching || isLoading : false,
  };
}
