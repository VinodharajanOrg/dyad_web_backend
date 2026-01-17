import { atom, WritableAtom } from "jotai";
import { type LocalModel } from "@/types/ipc_types";

// Helper to create properly typed writable atoms
function writableAtom<T>(initialValue: T): WritableAtom<T, [T], void> {
  return atom(initialValue) as any;
}

export const localModelsAtom = writableAtom<LocalModel[]>([]);
export const localModelsLoadingAtom = writableAtom<boolean>(false);
export const localModelsErrorAtom = writableAtom<Error | null>(null);

export const lmStudioModelsAtom = writableAtom<LocalModel[]>([]);
export const lmStudioModelsLoadingAtom = writableAtom<boolean>(false);
export const lmStudioModelsErrorAtom = writableAtom<Error | null>(null);
