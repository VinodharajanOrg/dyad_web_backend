import { ComponentSelection } from "@/types/ipc_types";
import { atom, WritableAtom } from "jotai";

// Helper to create properly typed writable atoms
function writableAtom<T>(initialValue: T): WritableAtom<T, [T], void> {
  return atom(initialValue) as any;
}

export const selectedComponentPreviewAtom =
  writableAtom<ComponentSelection | null>(null);
