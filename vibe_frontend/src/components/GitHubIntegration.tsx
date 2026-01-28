"use client";
import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";
import { useDisconnectGitHub } from "@/hooks/useDisconnectGitHub";

export function GitHubIntegration() {
  const { mutate: disconnectGitHub, isPending: isDisconnecting } = useDisconnectGitHub();

  const handleDisconnectFromGithub = () => {
    disconnectGitHub();
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          GitHub Integration
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Your account is connected to GitHub.
        </p>
      </div>

      <Button
        onClick={handleDisconnectFromGithub}
        variant="destructive"
        size="sm"
        disabled={isDisconnecting}
        className="flex items-center gap-2"
      >
        {isDisconnecting ? "Disconnecting..." : "Disconnect from GitHub"}
        <Github className="h-4 w-4" />
      </Button>
    </div>
  );
}
