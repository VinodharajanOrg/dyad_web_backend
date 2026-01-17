"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import ChatPage from "@/page-components/chat";

interface PageProps {
  params: Promise<{ appId: string }>;
}

export default function Page({ params }: PageProps) {
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);

  // Extract and set appId from URL route params immediately
  // This prevents race condition where old app APIs get called
  useEffect(() => {
    const setAppId = async () => {
      const { appId } = await params;
      const parsedAppId = parseInt(appId, 10);
      if (!isNaN(parsedAppId)) {
        setSelectedAppId(parsedAppId);
      }
    };
    setAppId();
  }, [params, setSelectedAppId]);

  return <ChatPage />;
}
