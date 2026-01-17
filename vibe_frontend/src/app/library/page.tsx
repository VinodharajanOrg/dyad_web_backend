"use client";

import LibraryPage from "@/page-components/library";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LibraryPage />
    </Suspense>
  );
}
