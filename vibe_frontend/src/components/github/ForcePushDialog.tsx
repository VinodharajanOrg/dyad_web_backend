import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ForcePushDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isProcessing: boolean;
  processingText?: string;
  confirmText?: string;
}

export function ForcePushDialog({
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
  processingText = "Force Pushing...",
  confirmText = "Force Push",
}: ForcePushDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Force Push Warning
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              <div>
                You are about to perform a <strong>force push</strong> to your
                GitHub repository.
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-md border border-orange-200 dark:border-orange-800">
                <div className="text-sm text-orange-800 dark:text-orange-200">
                  <strong>
                    This is dangerous and non-reversible and will:
                  </strong>
                </div>
                <ul className="text-sm text-orange-700 dark:text-orange-300 list-disc list-inside mt-2 space-y-1">
                  <li>Overwrite the remote repository history</li>
                  <li>
                    Permanently delete commits that exist on the remote but
                    not locally
                  </li>
                </ul>
              </div>
              <div className="text-sm">
                Only proceed if you're certain this is what you want to do.
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? processingText : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
