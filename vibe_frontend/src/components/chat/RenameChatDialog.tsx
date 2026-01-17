"use client";
import { useState } from "react";
import { useUpdateChat } from "@/hooks/useChats";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface RenameChatDialogProps {
  chatId: number;
  currentTitle: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
}

export function RenameChatDialog({
  chatId,
  currentTitle,
  isOpen,
  onOpenChange,
  onRename,
}: RenameChatDialogProps) {
  const [newTitle, setNewTitle] = useState("");
  const { mutate: updateChat, isPending } = useUpdateChat();

  // Reset title when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setNewTitle(currentTitle || "");
    } else {
      setNewTitle("");
    }
    onOpenChange(open);
  };

  const handleSave = async () => {
    if (!newTitle.trim()) {
      return;
    }

    updateChat(
      {
        chatId,
        params: {
          title: newTitle.trim(),
        },
      },
      {
        onSuccess: () => {
          // Call the parent's onRename callback to refresh the chat list
          onRename();

          // Close the dialog
          handleOpenChange(false);
        },
      },
    );
  };

  const handleClose = () => {
    handleOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Chat</DialogTitle>
          <DialogDescription>Enter a new name for this chat.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="chat-title" className="text-right">
              Title
            </Label>
            <Input
              id="chat-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="col-span-3"
              placeholder="Enter chat title..."
              disabled={isPending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isPending) {
                  handleSave();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!newTitle.trim() || isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
