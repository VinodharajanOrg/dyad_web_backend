"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useAtom, useSetAtom } from "jotai";
import {
  appsListAtom,
  selectedAppIdAtom,
} from "@/atoms/appAtoms";
import { useLoadApps } from "@/hooks/useLoadApps";
import { useUpdateApp, useDeleteApp, useCopyApp } from "@/hooks/useApps";
import { useCreateChat } from "@/hooks/useChats";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MoreVertical,
  MessageCircle,
  Pencil,
  Folder,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showSuccess, showError } from "@/lib/toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { invalidateAppQuery } from "@/hooks/useLoadApp";
import { useDebounce } from "@/hooks/useDebounce";
import { useCheckName } from "@/hooks/useCheckName";
import { SEARCH_DEBOUNCE_DELAY } from "@/lib/constants";

export default function AppDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [appsList] = useAtom(appsListAtom);
  const { refreshApps } = useLoadApps();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isRenameConfirmDialogOpen, setIsRenameConfirmDialogOpen] =
    useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isRenameFolderDialogOpen, setIsRenameFolderDialogOpen] =
    useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);
  
  const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
  const [newCopyAppName, setNewCopyAppName] = useState("");
  const queryClient = useQueryClient();
  const setSelectedAppId = useSetAtom(selectedAppIdAtom);
  const updateAppMutation = useUpdateApp();
  const deleteAppMutation = useDeleteApp();
  const copyAppMutationWeb = useCopyApp();
  const createChatMutation = useCreateChat();

  const debouncedNewCopyAppName = useDebounce(
    newCopyAppName,
    SEARCH_DEBOUNCE_DELAY,
  );
  const { data: checkNameResult, isLoading: isCheckingName } = useCheckName(
    debouncedNewCopyAppName,
  );
  const nameExists = checkNameResult?.exists ?? false;

  // Get the appId from search params and find the corresponding app
  const appId = searchParams.get("appId")
    ? Number(searchParams.get("appId"))
    : null;
  const selectedApp = appId ? appsList.find((app) => app.id === appId) : null;

  // Set the selectedAppId atom when this page loads so the title bar shows the correct app name
  useEffect(() => {
    if (appId) {
      setSelectedAppId(appId);
    }
  }, [appId, setSelectedAppId]);

  const handleDeleteApp = async () => {
    if (!appId) return;

    try {
      setIsDeleting(true);
      await deleteAppMutation.mutateAsync(appId);
      setIsDeleteDialogOpen(false);
      router.push("/");
    } catch (error) {
      setIsDeleteDialogOpen(false);
      showError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenRenameDialog = () => {
    if (selectedApp) {
      setNewAppName(selectedApp.name);
      setIsRenameDialogOpen(true);
    }
  };

  const handleOpenRenameFolderDialog = () => {
    if (selectedApp) {
      setNewFolderName(selectedApp.path.split("/").pop() || selectedApp.path);
      setIsRenameFolderDialogOpen(true);
    }
  };

  const handleRenameApp = async (renameFolder: boolean) => {
    if (!appId || !selectedApp || !newAppName.trim()) return;

    try {
      setIsRenaming(true);

      // Send renameFolder flag in the API request
      const updateParams: { name: string; renameFolder: boolean } = {
        name: newAppName,
        renameFolder: renameFolder,
      };

      // Update app name via web API with renameFolder flag
      await updateAppMutation.mutateAsync({
        appId,
        params: updateParams,
      });

      setIsRenameDialogOpen(false);
      setIsRenameConfirmDialogOpen(false);
      await refreshApps();
    } catch (error) {
      console.error("Failed to rename app:", error);
      alert(
        `Error renaming app: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRenameFolderOnly = async () => {
    if (!appId || !selectedApp || !newFolderName.trim()) return;

    try {
      setIsRenamingFolder(true);

      // Update only the folder path via web API
      // Keep the app name the same, only change the folder path
      await updateAppMutation.mutateAsync({
        appId,
        params: {
          name: selectedApp.name, // Keep the app name the same
          path: newFolderName, // Change only the folder path
        },
      });

      setIsRenameFolderDialogOpen(false);
      await refreshApps();
    } catch (error) {
      console.error("Failed to rename folder:", error);
      alert(
        `Error renaming folder: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setIsRenamingFolder(false);
    }
  };

  const handleAppNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCopyAppName(e.target.value);
  };

  const handleOpenCopyDialog = () => {
    if (selectedApp) {
      setNewCopyAppName(`${selectedApp.name}-copy`);
      setIsCopyDialogOpen(true);
    }
  };

  const copyAppMutation = useMutation({
    mutationFn: async (_params: { withHistory: boolean }) => {
      // withHistory parameter removed - unused
      if (!appId || !newCopyAppName.trim()) {
        throw new Error("Invalid app ID or name for copying.");
      }
      // NOTE: withHistory parameter not supported by web API yet
      // Using copyAppMutationWeb which calls POST /api/apps/:id/copy
      return copyAppMutationWeb.mutateAsync({
        appId,
        params: { name: newCopyAppName },
      });
    },
    onSuccess: async (copiedApp) => {
      const newAppId = copiedApp.id;
      setSelectedAppId(newAppId);
      await invalidateAppQuery(queryClient, { appId: newAppId });
      await refreshApps();
      // Create initial chat for the copied app
      await createChatMutation.mutateAsync({ appId: newAppId });
      setIsCopyDialogOpen(false);
      router.push(`/app-details?appId=${newAppId}`);
    },
    onError: (error) => {
      showError(error);
    },
  });

  if (!selectedApp) {
    return (
      <div className="relative min-h-screen p-8">
        <Button
          onClick={() => router.back()}
          variant="outline"
          size="sm"
          className="absolute top-4 left-4 flex items-center gap-1 bg-(--background-lightest) py-5"
        >
          <ArrowLeft className="h-3 w-4" />
          Back
        </Button>
        <div className="flex flex-col items-center justify-center h-full">
          <h2 className="text-xl font-bold">App not found</h2>
        </div>
      </div>
    );
  }

  // Use the 'path' property from the API response directly
  const fullAppPath = selectedApp.path;

  return (
    <div
      className="relative min-h-screen p-4 w-full"
      data-testid="app-details-page"
    >
      <Button
        onClick={() => router.back()}
        variant="outline"
        size="sm"
        className="absolute top-4 left-4 flex items-center gap-1 bg-(--background-lightest) py-2"
      >
        <ArrowLeft className="h-3 w-4" />
        Back
      </Button>

      <div className="w-full max-w-2xl mx-auto mt-10 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm relative">
        <div className="flex items-center mb-3">
          <h2 className="text-2xl font-bold">{selectedApp.name}</h2>
          <Button
            variant="ghost"
            size="sm"
            className="ml-1 p-0.5 h-auto"
            onClick={handleOpenRenameDialog}
            data-testid="app-details-rename-app-button"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Overflow Menu in top right */}
        <div className="absolute top-2 right-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                data-testid="app-details-more-options-button"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-2" align="end">
              <div className="flex flex-col space-y-0.5">
                {/* NOTE: The "Rename folder" feature is currently disabled. Implement it later. */}
                <Button
                  onClick={handleOpenRenameFolderDialog}
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start text-xs"
                  disabled
                >
                  Rename folder
                </Button>
                {/* NOTE: The "Copy app" feature is currently disabled. Implement it later. */}
                <Button
                  onClick={handleOpenCopyDialog}
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start text-xs"
                  disabled
                >
                  Copy app
                </Button>
                <Button
                  onClick={() => setIsDeleteDialogOpen(true)}
                  variant="ghost"
                  size="sm"
                  className="h-8 justify-start text-xs"
                >
                  Delete
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <span className="block text-gray-500 dark:text-gray-400 mb-0.5 text-xs">
              Created
            </span>
            <span>{selectedApp.createdAt.toString()}</span>
          </div>
          <div>
            <span className="block text-gray-500 dark:text-gray-400 mb-0.5 text-xs">
              Last Updated
            </span>
            <span>{selectedApp.updatedAt.toString()}</span>
          </div>
          <div className="col-span-2">
            <span className="block text-gray-500 dark:text-gray-400 mb-0.5 text-xs">
              Path
            </span>
            <div className="flex items-center gap-1">
              <span className="text-sm break-all">{fullAppPath}</span>
              <Button
                variant="ghost"
                size="sm"
                className="p-0.5 h-auto cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(fullAppPath);
                    // Replace alert with your toast/snackbar system
                    showSuccess("Path copied to clipboard!");
                  } catch {
                    showError("Failed to copy path.");
                  }
                }}
                title="Copy path"
              >
                <Folder className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={() => {
              if (!appId) {
                console.error("No app id found");
                return;
              }
              router.push(`/${appId}/chat`);
            }}
            className="cursor-pointer w-full py-5 flex justify-center items-center gap-2"
            size="lg"
          >
            Open in Chat
            <MessageCircle className="h-4 w-4" />
          </Button>
          {/* NOTE: hide this features as of now
          <div className="border border-gray-200 rounded-md p-4">
            <GitHubConnector appId={appId} folderName={selectedApp.path} />
          </div>
          {appId && <SupabaseConnector appId={appId} />}
          {appId && <CapacitorControls appId={appId} />}
          <AppUpgrades appId={appId} /> */}
        </div>

        {/* Rename Dialog */}
        <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle>Rename App</DialogTitle>
            </DialogHeader>
            <Input
              value={newAppName}
              onChange={(e) => setNewAppName(e.target.value)}
              placeholder="Enter new app name"
              className="my-2"
              autoFocus
            />
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRenameDialogOpen(false)}
                disabled={isRenaming}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setIsRenameDialogOpen(false);
                  setIsRenameConfirmDialogOpen(true);
                }}
                disabled={isRenaming || !newAppName.trim()}
                size="sm"
              >
                Continue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Folder Dialog */}
        <Dialog
          open={isRenameFolderDialogOpen}
          onOpenChange={setIsRenameFolderDialogOpen}
        >
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle>Rename app folder</DialogTitle>
              <DialogDescription className="text-xs">
                This will change only the folder name, not the app name.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Enter new folder name"
              className="my-2"
              autoFocus
            />
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRenameFolderDialogOpen(false)}
                disabled={isRenamingFolder}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRenameFolderOnly}
                disabled={isRenamingFolder || !newFolderName.trim()}
                size="sm"
              >
                {isRenamingFolder ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3 mr-1"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Renaming...
                  </>
                ) : (
                  "Rename Folder"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rename Confirmation Dialog */}
        <Dialog
          open={isRenameConfirmDialogOpen}
          onOpenChange={setIsRenameConfirmDialogOpen}
        >
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-base">
                How would you like to rename "{selectedApp.name}"?
              </DialogTitle>
              <DialogDescription className="text-xs">
                Choose an option:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 my-2">
              <Button
                variant="outline"
                className="w-full justify-start p-2 h-auto relative text-sm"
                onClick={() => handleRenameApp(true)}
                disabled={isRenaming}
              >
                <div className="absolute top-1 right-1">
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-1.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300 text-[10px]">
                    Recommended
                  </span>
                </div>
                <div className="text-left">
                  <p className="font-medium text-xs">Rename app and folder</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Renames the folder to match the new app name.
                  </p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start p-2 h-auto text-sm"
                onClick={() => handleRenameApp(false)}
                disabled={isRenaming}
              >
                <div className="text-left">
                  <p className="font-medium text-xs">Rename app only</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    The folder name will remain the same.
                  </p>
                </div>
              </Button>
            </div>
            <DialogFooter className="pt-2">
              <Button
                variant="outline"
                onClick={() => setIsRenameConfirmDialogOpen(false)}
                disabled={isRenaming}
                size="sm"
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Copy App Dialog */}
        {selectedApp && (
          <Dialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
            <DialogContent className="max-w-md p-4">
              <DialogHeader className="pb-2">
                <DialogTitle>Copy "{selectedApp.name}"</DialogTitle>
                <DialogDescription className="text-sm">
                  <p>Create a copy of this app.</p>
                  <p>
                    Note: this does not copy over the Supabase project or GitHub
                    project.
                  </p>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 my-2">
                <div>
                  <Label htmlFor="newAppName">New app name</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newAppName"
                      value={newCopyAppName}
                      onChange={handleAppNameChange}
                      placeholder="Enter new app name"
                      className="pr-8"
                      disabled={copyAppMutation.isPending}
                    />
                    {isCheckingName && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {nameExists && (
                    <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                      An app with this name already exists. Please choose
                      another name.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start p-2 h-auto relative text-sm"
                    onClick={() =>
                      copyAppMutation.mutate({ withHistory: true })
                    }
                    disabled={
                      copyAppMutation.isPending ||
                      nameExists ||
                      !newCopyAppName.trim() ||
                      isCheckingName
                    }
                  >
                    {copyAppMutation.isPending &&
                      copyAppMutation.variables?.withHistory === true && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                    <div className="absolute top-1 right-1">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-1.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300 text-[10px]">
                        Recommended
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-xs">
                        Copy app with history
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Copies the entire app, including the Git version
                        history.
                      </p>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start p-2 h-auto text-sm"
                    onClick={() =>
                      copyAppMutation.mutate({ withHistory: false })
                    }
                    disabled={
                      copyAppMutation.isPending ||
                      nameExists ||
                      !newCopyAppName.trim() ||
                      isCheckingName
                    }
                  >
                    {copyAppMutation.isPending &&
                      copyAppMutation.variables?.withHistory === false && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                    <div className="text-left">
                      <p className="font-medium text-xs">
                        Copy app without history
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Useful if the current app has a Git-related issue.
                      </p>
                    </div>
                  </Button>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCopyDialogOpen(false)}
                  disabled={copyAppMutation.isPending}
                  size="sm"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="max-w-sm p-4">
            <DialogHeader className="pb-2">
              <DialogTitle>Delete "{selectedApp.name}"?</DialogTitle>
              <DialogDescription className="text-xs">
                This action is irreversible. All app files and chat history will
                be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                size="sm"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteApp}
                disabled={isDeleting}
                className="flex items-center gap-1"
                size="sm"
              >
                {isDeleting ? (
                  <>
                    <svg
                      className="animate-spin h-3 w-3 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Delete App"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
