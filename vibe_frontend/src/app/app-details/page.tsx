"use client";

import AppDetailsPage from "@/page-components/app-details";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AppDetailsPage />
    </Suspense>
  );
}
