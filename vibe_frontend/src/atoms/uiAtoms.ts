import { atom, WritableAtom } from "jotai";

// Helper to create properly typed writable atoms
function writableAtom<T>(initialValue: T): WritableAtom<T, [T], void> {
  return atom(initialValue) as any;
}

// Atom to track if any dropdown is currently open in the UI
export const dropdownOpenAtom = writableAtom<boolean>(false);
