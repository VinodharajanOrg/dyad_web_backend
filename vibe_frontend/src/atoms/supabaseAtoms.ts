import { atom, WritableAtom } from "jotai";
import { SupabaseBranch } from "@/types/ipc_types";

// Helper to create properly typed writable atoms
function writableAtom<T>(initialValue: T): WritableAtom<T, [T], void> {
  return atom(initialValue) as any;
}

// Define atom for storing the list of Supabase projects
export const supabaseProjectsAtom = writableAtom<any[]>([]);
export const supabaseBranchesAtom = writableAtom<SupabaseBranch[]>([]);

// Define atom for tracking loading state
export const supabaseLoadingAtom = writableAtom<boolean>(false);

// Define atom for storing any error that occurs during loading
export const supabaseErrorAtom = writableAtom<Error | null>(null);

// Define atom for storing the currently selected Supabase project
export const selectedSupabaseProjectAtom = writableAtom<string | null>(null);
