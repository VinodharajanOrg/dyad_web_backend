import type { Message } from "@/types/ipc_types";
import { atom, WritableAtom } from "jotai";
import type { ChatSummary, LargeLanguageModel, ChatMode } from "@/lib/schemas";

// Helper to create properly typed writable atoms
function writableAtom<T>(
  initialValue: T,
): WritableAtom<T, [T | ((prev: T) => T)], void> {
  return atom(initialValue) as any;
}

// Per-chat atoms implemented with maps keyed by chatId
export const chatMessagesByIdAtom = writableAtom<Map<number, Message[]>>(
  new Map(),
);
export const chatErrorByIdAtom = writableAtom<Map<number, string | null>>(
  new Map(),
);

// Atom to hold the currently selected chat ID
export const selectedChatIdAtom = writableAtom<number | null>(null);

export const isStreamingByIdAtom = writableAtom<Map<number, boolean>>(
  new Map(),
);
export const chatInputValueAtom = writableAtom<string>("");
export const homeChatInputValueAtom = writableAtom<string>("");

// Atoms for chat list management
export const chatsAtom = writableAtom<ChatSummary[]>([]);
export const chatsLoadingAtom = writableAtom<boolean>(false);

// Used for scrolling to the bottom of the chat messages (per chat)
export const chatStreamCountByIdAtom = writableAtom<Map<number, number>>(
  new Map(),
);
export const recentStreamChatIdsAtom = writableAtom<Set<number>>(
  new Set<number>(),
);

// UI state atoms for selected chat mode and model (session-only, not persisted)
export const selectedChatModeAtom = writableAtom<ChatMode>("build");
export const selectedModelAtom = writableAtom<LargeLanguageModel | null>(null);
