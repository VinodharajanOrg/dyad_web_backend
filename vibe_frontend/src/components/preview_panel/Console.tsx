"use client";
import { appOutputAtom, selectedAppIdAtom } from "@/atoms/appAtoms";
import { useAtomValue } from "jotai";

// Console component
export const Console = () => {
  const appOutput = useAtomValue(appOutputAtom);
  const selectedAppId = useAtomValue(selectedAppIdAtom);

  // Filter messages to show only for the currently selected app
  const filteredOutput = appOutput.filter(
    (output) => output.appId === selectedAppId,
  );

  return (
    <div className="font-mono text-xs px-4 h-full overflow-auto">
      {filteredOutput.map((output, index) => (
        <div key={index}>{output.message}</div>
      ))}
    </div>
  );
};
