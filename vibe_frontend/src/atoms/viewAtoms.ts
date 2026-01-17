import { atom } from "jotai";

// Base atom
const isPreviewOpenBaseAtom = atom(false);

// Writable atom for isPreviewOpen
export const isPreviewOpenAtom = atom(
  (get) => get(isPreviewOpenBaseAtom),
  (get, set, newValue: boolean) => {
    set(isPreviewOpenBaseAtom, newValue);
  },
);
export const selectedFileAtom = atom<{
  path: string;
} | null>(null);
export const activeSettingsSectionAtom = atom<string | null>(
  "general-settings",
);
