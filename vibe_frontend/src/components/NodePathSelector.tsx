"use client";

import { AlertTriangle } from "lucide-react";

export function NodePathSelector() {
  return (
    <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
        <AlertTriangle className="w-4 h-4" />
        <p className="text-sm">
          Node.js path configuration is not available in web mode.
        </p>
      </div>
    </div>
  );
}
