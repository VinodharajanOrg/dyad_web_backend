"use client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./ui/command";
import { useState, useEffect } from "react";
import { useSearchChats } from "@/hooks/useSearchChats";
import type { ChatSummary } from "@/api/endpoints/chats";
import { SEARCH_DEBOUNCE_DELAY } from "@/lib/constants";

type ChatSearchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectChat: ({ chatId, appId }: { chatId: number; appId: number }) => void;
  allChats: ChatSummary[];
};

export function ChatSearchDialog({
  open,
  onOpenChange,
  onSelectChat,
  allChats,
}: ChatSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState<T>(value);
    useEffect(() => {
      const handle = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(handle);
    }, [value, delay]);
    return debounced;
  }

  const debouncedQuery = useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_DELAY);
  const { chats: searchResults } = useSearchChats(debouncedQuery);

  // Show all chats if search is empty, otherwise show search results
  const chatsToShow = debouncedQuery.trim() === "" ? allChats : searchResults;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      data-testid="chat-search-dialog"
    >
      <CommandInput
        placeholder="Search chats"
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Chats">
          {chatsToShow.map((chat) => {
            const isSearch = searchQuery.trim() !== "";
            // For search results (ChatWithMessages), show message snippets
            const hasSnippet =
              isSearch &&
              "messages" in chat &&
              Array.isArray(chat.messages) &&
              chat.messages.length > 0;
            const snippet = hasSnippet
              ? {
                  raw: (chat as any).messages[0]?.content.slice(0, 100) || "",
                  before: "",
                  match: "",
                  after: "",
                }
              : null;
            return (
              <CommandItem
                key={chat.id}
                onSelect={() =>
                  onSelectChat({ chatId: chat.id, appId: chat.appId })
                }
                value={
                  (chat.title || "Untitled Chat") +
                  (snippet ? ` ${snippet.raw}` : "")
                }
                keywords={snippet ? [snippet.raw] : []}
              >
                <div className="flex flex-col">
                  <span>{chat.title || "Untitled Chat"}</span>
                  {snippet && (
                    <span className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {snippet.raw}
                    </span>
                  )}
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
