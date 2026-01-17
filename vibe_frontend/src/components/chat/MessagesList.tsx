"use client";
import type React from "react";
import type { Message } from "@/types/ipc_types";
import { forwardRef, useState } from "react";
import ChatMessage from "./ChatMessage";
import { OpenRouterSetupBanner } from "../SetupBanner";
import { useStreamChat } from "@/hooks/useStreamChat";
import { selectedChatIdAtom } from "@/atoms/chatAtoms";
import { useAtomValue, useSetAtom } from "jotai";
import { Loader2, Undo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectedAppIdAtom } from "@/atoms/appAtoms";
import { showError, showWarning } from "@/lib/toast";
import { chatMessagesByIdAtom } from "@/atoms/chatAtoms";
import { useLanguageModelProviders } from "@/hooks/useLanguageModelProviders";
import { useSettings } from "@/hooks/useSettings";
import { useDeleteChatMessages } from "@/hooks/useChats";

interface MessagesListProps {
  messages: Message[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  chatData?: any;
}

export const MessagesList = forwardRef<HTMLDivElement, MessagesListProps>(
  function MessagesList({ messages, messagesEndRef, chatData }, ref) {
    const appId = useAtomValue(selectedAppIdAtom);
    const selectedChatId = useAtomValue(selectedChatIdAtom);
    const deleteChatMessagesMutation = useDeleteChatMessages();
    // const { versions, revertVersion } = useVersions(appId);
    const { isStreaming } = useStreamChat();
    const { isAnyProviderSetup, isProviderSetup } = useLanguageModelProviders();
    const { settings } = useSettings();
    const setMessagesById = useSetAtom(chatMessagesByIdAtom);
    const [isUndoLoading, setIsUndoLoading] = useState(false);
    //const [isRetryLoading, setIsRetryLoading] = useState(false);
    //const {userBudget } = useUserBudgetInfo();

    const renderSetupBanner = () => {
      const selectedModel = settings?.selectedModel;
      if (
        selectedModel?.name === "free" &&
        selectedModel?.provider === "auto" &&
        !isProviderSetup("openrouter")
      ) {
        return <OpenRouterSetupBanner className="w-full" />;
      }
      if (!isAnyProviderSetup()) {
        {
          /* NOTE: Bypass initial node and AI setup for web */
        }
        // return <SetupBanner />;
        return null;
      }
      return null;
    };

    return (
      <div
        className="absolute inset-0 overflow-y-auto p-4"
        ref={ref}
        data-testid="messages-list"
      >
        {messages.length > 0
          ? messages.map((message, index) => (
              <ChatMessage
                key={index}
                message={message}
                chatId={message.chatId}
                isLastMessage={index === messages.length - 1}
              />
            ))
          : !renderSetupBanner() && (
              <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto">
                <div className="flex flex-1 items-center justify-center text-gray-500">
                  No messages yet
                </div>
              </div>
            )}
        {!isStreaming && (
          <div className="flex max-w-3xl mx-auto gap-2">
            {!!messages.length &&
              messages[messages.length - 1].role === "assistant" &&
              messages[messages.length - 1].commitHash && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUndoLoading}
                  onClick={async () => {
                    if (!selectedChatId || !appId) {
                      console.error("No chat selected or app ID not available");
                      return;
                    }

                    setIsUndoLoading(true);
                    try {
                      if (messages.length >= 3) {
                        const previousAssistantMessage =
                          messages[messages.length - 3];
                        if (
                          previousAssistantMessage?.role === "assistant" &&
                          previousAssistantMessage?.commitHash
                        ) {
                          console.debug(
                            "Reverting to previous assistant version",
                          );
                          // NOTE: As of now, we are not reverting versions in web mode
                          // await revertVersion({
                          //   versionId: previousAssistantMessage.commitHash,
                          // });
                          // Messages will be updated via TanStack Query refetch in ChatPanel
                          // Remove last 2 messages (user + assistant) from local state
                          setMessagesById((prev: Map<number, Message[]>) => {
                            const next = new Map(prev);
                            const currentMessages =
                              prev.get(selectedChatId!) || [];
                            next.set(
                              selectedChatId!,
                              currentMessages.slice(0, -2),
                            );
                            return next;
                          });
                        }
                      } else {
                        if (chatData?.initialCommitHash) {
                          // NOTE: As of now, we are not reverting versions in web mode
                          // await revertVersion({
                          //   versionId: chatData.initialCommitHash,
                          // });
                          try {
                            if (selectedChatId) {
                              await deleteChatMessagesMutation.mutateAsync(
                                selectedChatId,
                              );
                            }
                            setMessagesById((prev) => {
                              const next = new Map(prev);
                              next.set(selectedChatId!, []);
                              return next;
                            });
                          } catch (err) {
                            showError(err);
                          }
                        } else {
                          showWarning(
                            "No initial commit hash found for chat. Need to manually undo code changes",
                          );
                        }
                      }
                    } catch (error) {
                      console.error("Error during undo operation:", error);
                      showError("Failed to undo changes");
                    } finally {
                      setIsUndoLoading(false);
                    }
                  }}
                >
                  {isUndoLoading ? (
                    <Loader2 size={16} className="mr-1 animate-spin" />
                  ) : (
                    <Undo size={16} />
                  )}
                  Undo
                </Button>
              )}
            {/* NOTE: hide retry button for now as it can be confusing */}
            {/* {!!messages.length && (
              <Button
                variant="outline"
                size="sm"
                disabled={isRetryLoading}
                onClick={async () => {
                  if (!selectedChatId) {
                    console.error("No chat selected");
                    return;
                  }
 
                  setIsRetryLoading(true);
                  try {
                    // The last message is usually an assistant, but it might not be.
                    const lastVersion = versions?.[0];
                    const lastMessage = messages[messages.length - 1];
                    let shouldRedo = true;
                    if (
                      lastVersion &&
                      lastVersion.oid === lastMessage.commitHash &&
                      lastMessage.role === "assistant"
                    ) {
                      const previousAssistantMessage =
                        messages[messages.length - 3];
                      if (
                        previousAssistantMessage?.role === "assistant" &&
                        previousAssistantMessage?.commitHash
                      ) {
                        console.debug(
                          "Reverting to previous assistant version",
                        );
                        await revertVersion({
                          versionId: previousAssistantMessage.commitHash,
                        });
                        shouldRedo = false;
                      } else {
                        if (chatData?.initialCommitHash) {
                          console.debug(
                            "Reverting to initial commit hash",
                            chatData.initialCommitHash,
                          );
                          await revertVersion({
                            versionId: chatData.initialCommitHash,
                          });
                        } else {
                          showWarning(
                            "No initial commit hash found for chat. Need to manually undo code changes",
                          );
                        }
                      }
                    }
 
                    // Find the last user message
                    const lastUserMessage = [...messages]
                      .reverse()
                      .find((message) => message.role === "user");
                    if (!lastUserMessage) {
                      console.error("No user message found");
                      return;
                    }
                    // Need to do a redo, if we didn't delete the message from a revert.
                    const redo = shouldRedo;
                    console.debug("Streaming message with redo", redo);
 
                    streamMessage({
                      prompt: lastUserMessage.content,
                      chatId: selectedChatId,
                      redo,
                    });
                  } catch (error) {
                    console.error("Error during retry operation:", error);
                    showError("Failed to retry message");
                  } finally {
                    setIsRetryLoading(false);
                  }
                }}
              >
                {isRetryLoading ? (
                  <Loader2 size={16} className="mr-1 animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Retry
              </Button>
            )} */}
          </div>
        )}

        {/* // NOTE:
          PROMO MESSAGE DISABLED: Shows promotional message while AI is streaming
          This displays "Tired of waiting on AI? Get Dyad Pro for faster edits with Turbo Edits."
          
          Display Conditions (when enabled):
          - isStreaming: AI is actively processing the response
          - !settings?.enableDyadPro: User does NOT have Dyad Pro enabled
          - !userBudget: User does NOT have a budget (on free plan)
          - messages.length > 0: There are messages in the chat
          
          To re-enable: Uncomment the code block below
 
        {isStreaming &&
          !settings?.enableDyadPro &&
          !userBudget &&
          messages.length > 0 && (
            <PromoMessage
              seed={messages.length * (appId ?? 1) * (selectedChatId ?? 1)}
            />
            )
          }
        */}
        <div ref={messagesEndRef} />
        {renderSetupBanner()}
      </div>
    );
  },
);
