"use client";

import HubPage from "@/page-components/hub";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HubPage />
    </Suspense>
  );
}
