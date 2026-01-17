import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  chatsApi,
  type CreateChatParams,
  type UpdateChatParams,
} from "@/api/endpoints/chats";
import { toast } from "sonner";
import {
  CHAT_MESSAGES_STALE_TIME,
  CHAT_MESSAGES_GC_TIME,
} from "@/lib/constants";

/**
 * Query key factory for chats
 */
export const chatsKeys = {
  all: ["chats"] as const,
  lists: () => [...chatsKeys.all, "list"] as const,
  list: (appId?: number) => [...chatsKeys.lists(), { appId }] as const,
  details: () => [...chatsKeys.all, "detail"] as const,
  detail: (id: number) => [...chatsKeys.details(), id] as const,
  searches: () => [...chatsKeys.all, "search"] as const,
  search: (appId: number, query: string) =>
    [...chatsKeys.searches(), { appId, query }] as const,
};

/**
 * Hook to fetch chats (optionally filtered by app)
 * NOTE: Query is disabled when appId is not provided to prevent 400 errors
 */
export function useChats(appId?: number) {
  return useQuery({
    queryKey: chatsKeys.list(appId),
    queryFn: () => chatsApi.list(appId),
    enabled: !!appId, // Only fetch when appId is provided
  });
}

/**
 * Hook to fetch all chats (no app filter)
 * Use this when you need to get all chats across all apps
 */
export function useAllChats() {
  return useQuery({
    queryKey: chatsKeys.list(undefined),
    queryFn: () => chatsApi.list(),
    staleTime: CHAT_MESSAGES_STALE_TIME,
    gcTime: CHAT_MESSAGES_GC_TIME,
  });
}

/**
 * Hook to fetch a single chat (without messages)
 */
export function useChat(chatId: number) {
  return useQuery({
    queryKey: chatsKeys.detail(chatId),
    queryFn: () => chatsApi.get(chatId),
    enabled: !!chatId,
  });
}

/**
 * Hook to fetch messages for a chat
 * NOTE: Aggressive caching to prevent multiple calls during navigation
 */
export function useChatMessages(chatId: number) {
  return useQuery({
    queryKey: [...chatsKeys.detail(chatId), "messages"] as const,
    queryFn: () => chatsApi.getMessages(chatId),
    enabled: !!chatId,
    staleTime: CHAT_MESSAGES_STALE_TIME,
    gcTime: CHAT_MESSAGES_GC_TIME,
    refetchOnMount: false, // Don't refetch on mount if data exists
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnReconnect: false, // Don't refetch on reconnect
  });
}

/**
 * Hook to create a new chat
 */
export function useCreateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateChatParams) => chatsApi.create(params),
    onSuccess: (newChat, variables) => {
      // Invalidate chats list for this app
      queryClient.invalidateQueries({
        queryKey: chatsKeys.list(variables.appId),
      });
      queryClient.invalidateQueries({ queryKey: chatsKeys.lists() });
      toast.success("Chat created successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create chat");
    },
  });
}

/**
 * Hook to update a chat
 */
export function useUpdateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chatId,
      params,
    }: {
      chatId: number;
      params: UpdateChatParams;
    }) => chatsApi.update(chatId, params),
    onSuccess: (updatedChat) => {
      // Invalidate specific chat and lists
      queryClient.invalidateQueries({
        queryKey: chatsKeys.detail(updatedChat.id),
      });
      queryClient.invalidateQueries({ queryKey: chatsKeys.lists() });
      toast.success("Chat updated successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update chat");
    },
  });
}

/**
 * Hook to delete a chat
 */
export function useDeleteChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chatId: number) => chatsApi.delete(chatId),
    onSuccess: (_, chatId) => {
      // Remove from cache and refetch lists
      queryClient.removeQueries({ queryKey: chatsKeys.detail(chatId) });
      queryClient.invalidateQueries({ queryKey: chatsKeys.lists() });
      toast.success("Chat deleted successfully!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete chat");
    },
  });
}

/**
 * Hook to delete all messages in a chat
 */
export function useDeleteChatMessages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chatId: number) => chatsApi.deleteMessages(chatId),
    onSuccess: (_, chatId) => {
      // Refetch the chat to show empty messages
      queryClient.invalidateQueries({ queryKey: chatsKeys.detail(chatId) });
      toast.success("All messages deleted!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete messages");
    },
  });
}

/**
 * Hook to search chats
 */
export function useSearchChats(appId: number, query: string, enabled = true) {
  return useQuery({
    queryKey: chatsKeys.search(appId, query),
    queryFn: () => chatsApi.search(query),
    enabled: enabled && !!appId && query.length > 0,
  });
}
