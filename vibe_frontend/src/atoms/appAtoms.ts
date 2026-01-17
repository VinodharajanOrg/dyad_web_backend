import { atom, WritableAtom } from "jotai";
import type { App, AppOutput, Version } from "@/types/ipc_types";
import type { UserSettings } from "@/lib/schemas";

// Helper to create properly typed writable atoms
function writableAtom<T>(
  initialValue: T,
): WritableAtom<T, [T | ((prev: T) => T)], void> {
  return atom(initialValue) as any;
}

export const currentAppAtom = writableAtom<App | null>(null);
export const selectedAppIdAtom = writableAtom<number | null>(null);
export const appsListAtom = writableAtom<App[]>([]);
export const appBasePathAtom = writableAtom<string>("");
export const versionsListAtom = writableAtom<Version[]>([]);
export const previewModeAtom = writableAtom<
  "preview" | "code" | "problems" | "configure" | "publish" | "security"
>("preview");
export const selectedVersionIdAtom = writableAtom<string | null>(null);
export const appOutputAtom = writableAtom<AppOutput[]>([]);
export const appUrlAtom = writableAtom<
  | { appUrl: string; appId: number; originalUrl: string }
  | { appUrl: null; appId: null; originalUrl: null }
>({ appUrl: null, appId: null, originalUrl: null });
export const userSettingsAtom = writableAtom<UserSettings | null>(null);

// Atom for storing allow-listed environment variables
export const envVarsAtom = writableAtom<Record<string, string | undefined>>({});

export const previewPanelKeyAtom = writableAtom<number>(0);

export const previewErrorMessageAtom = writableAtom<
  { message: string; source: "preview-app" | "dyad-app" } | undefined
>(undefined);

// Atom to persist last running Docker appId across component unmounts
export const lastDockerAppIdAtom = writableAtom<number | null>(null);

/**
 * Atom to store the number of active checkoutVersion mutations.
 * This is a "primitive" atom that you will update directly.
 */
export const activeCheckoutCounterAtom = atom(0);

/**
 * Derived atom that is true if any checkoutVersion mutation is in progress.
 * This atom is read-only and derives its state from activeCheckoutCounterAtom.
 */
export const isAnyCheckoutVersionInProgressAtom = atom(
  (get) => get(activeCheckoutCounterAtom) > 0,
);
