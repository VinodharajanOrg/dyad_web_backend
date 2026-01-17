"use client";

import { ProviderSettingsPage } from "@/components/settings/ProviderSettingsPage";
import { use } from "react";

export default function ProviderPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = use(params);

  return <ProviderSettingsPage provider={provider} />;
}
