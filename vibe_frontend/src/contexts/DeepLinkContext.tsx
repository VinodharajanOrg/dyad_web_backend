"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IpcClient } from "@/api/ipc_client";
import { DeepLinkData } from "@/types/deep-links";
import { useScrollAndNavigateTo } from "@/hooks/useScrollAndNavigateTo";

type DeepLinkContextType = {
  lastDeepLink: (DeepLinkData & { timestamp: number }) | null;
  clearLastDeepLink: () => void;
};

const DeepLinkContext = createContext<DeepLinkContextType>({
  lastDeepLink: null,
  clearLastDeepLink: () => {},
});

export function DeepLinkProvider({ children }: { children: React.ReactNode }) {
  const [lastDeepLink, setLastDeepLink] = useState<
    (DeepLinkData & { timestamp: number }) | null
  >(null);
  const router = useRouter();
  const scrollAndNavigateTo = useScrollAndNavigateTo("/settings", {
    behavior: "smooth",
    block: "start",
  });
  useEffect(() => {
    const ipcClient = IpcClient.getInstance();
    if (!ipcClient) {
      // Web mode - deep links not supported
      return;
    }

    const unsubscribe = (ipcClient as any).onDeepLinkReceived((data: any) => {
      // Update with timestamp to ensure state change even if same type comes twice
      setLastDeepLink({ ...data, timestamp: Date.now() });
      if (data.type === "add-mcp-server") {
        // Navigate to tools-mcp section
        scrollAndNavigateTo("tools-mcp");
      } else if (data.type === "add-prompt") {
        // Navigate to settings-test page (library not available in web mode)
        router.push("/settings");
      }
    });

    return unsubscribe;
  }, [router, scrollAndNavigateTo]);

  return (
    <DeepLinkContext.Provider
      value={{
        lastDeepLink,
        clearLastDeepLink: () => setLastDeepLink(null),
      }}
    >
      {children}
    </DeepLinkContext.Provider>
  );
}

export const useDeepLink = () => useContext(DeepLinkContext);
