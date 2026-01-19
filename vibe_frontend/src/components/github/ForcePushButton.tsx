import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ForcePushButtonProps {
  onClick: () => void;
}

export function ForcePushButton({ onClick }: ForcePushButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="sm"
      className="mt-2 text-orange-600 border-orange-600 hover:bg-orange-50"
    >
      <AlertTriangle className="h-4 w-4 mr-2" />
      Force Push (Dangerous)
    </Button>
  );
}
