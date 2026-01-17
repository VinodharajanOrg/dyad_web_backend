"use client";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useState } from "react";
import { ImportAppDialog } from "./ImportAppDialog";

export function ImportAppButton({ streamMessage }: { streamMessage: any }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <div className="px-4 pb-1 flex justify-center">
        {/* NOTE: Disabling Import App button for now. */}
        <Button
          variant="default"
          size="default"
          onClick={() => setIsDialogOpen(true)}
          disabled
        >
          <Upload className="mr-2 h-4 w-4" />
          Import App
        </Button>
      </div>
      <ImportAppDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        streamMessage={streamMessage}
      />
    </>
  );
}
