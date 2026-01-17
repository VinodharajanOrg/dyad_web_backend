import { useCallback, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ComponentSelection,
  Message,
  FileAttachment,
} from "@/types/ipc_types";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  chatErrorByIdAtom,
  chatMessagesByIdAtom,
  chatStreamCountByIdAtom,
  isStreamingByIdAtom,
  recentStreamChatIdsAtom,
  selectedChatModeAtom,
  selectedModelAtom,
} from "@/atoms/chatAtoms";
import { IpcClient } from "@/api/ipc_client";
import { isPreviewOpenAtom } from "@/atoms/viewAtoms";
import type { ChatResponseEnd } from "@/types/ipc_types";
import { useChats } from "./useChats";
import { useLoadApp } from "./useLoadApp";
import { selectedAppIdAtom, previewPanelKeyAtom } from "@/atoms/appAtoms";
import { showExtraFilesToast } from "@/lib/toast";
import { useProposal } from "./useProposal";
import { useSearchParams } from "next/navigation";
import { useRunApp } from "./useRunApp";
// import { useDockerSync } from "./useDockerLifecycle";
import { useCountTokens } from "./useCountTokens";
import { useUserBudgetInfo } from "./useUserBudgetInfo";
import { usePostHog } from "posthog-js/react";
import { useCheckProblems } from "./useCheckProblems";
import { useSettings } from "./useSettings";
import { useLanguageModelsByProviders } from "./useLanguageModelsByProviders";
import { useLanguageModelProviders } from "./useLanguageModelProviders";

export function getRandomNumberId() {
  return Math.floor(Math.random() * 1_000_000_000_000_000);
}

export function useStreamChat({
  hasChatId = true,
}: { hasChatId?: boolean } = {}) {
  const setMessagesById = useSetAtom(chatMessagesByIdAtom);
  const isStreamingById = useAtomValue(isStreamingByIdAtom);
  const setIsStreamingById = useSetAtom(isStreamingByIdAtom);
  const errorById = useAtomValue(chatErrorByIdAtom);
  const setErrorById = useSetAtom(chatErrorByIdAtom);
  const setIsPreviewOpen = useSetAtom(isPreviewOpenAtom);
  const [selectedAppId] = useAtom(selectedAppIdAtom);
  const { refetch: refreshChats } = useChats(selectedAppId ?? undefined);
  const { refreshApp } = useLoadApp(selectedAppId);
  const setPreviewPanelKey = useSetAtom(previewPanelKeyAtom);

  const setStreamCountById = useSetAtom(chatStreamCountByIdAtom);
  // const { refreshVersions } = useVersions(selectedAppId);
  const { refreshAppIframe } = useRunApp();
  const { countTokens } = useCountTokens();
  const { refetchUserBudget } = useUserBudgetInfo();
  const { checkProblems } = useCheckProblems(selectedAppId);
  const { settings } = useSettings();
  const { data: modelsByProviders } = useLanguageModelsByProviders();
  const { data: providers } = useLanguageModelProviders();
  const setRecentStreamChatIds = useSetAtom(recentStreamChatIdsAtom);
  const posthog = usePostHog();
  const queryClient = useQueryClient();
  // const { syncToDocker } = useDockerSync();

  // Get the UI state atoms for selected chat mode and model
  const selectedChatMode = useAtomValue(selectedChatModeAtom);
  const selectedModel = useAtomValue(selectedModelAtom);
  const setSelectedChatMode = useSetAtom(selectedChatModeAtom);
  const setSelectedModel = useSetAtom(selectedModelAtom);

  // Initialize atoms from settings on mount - simplified to just check once
  useEffect(() => {
    if (!settings) return;

    // Only initialize on first load (when atoms still have default values)
    if (selectedChatMode === "build" && settings.selectedChatMode) {
      setSelectedChatMode(settings.selectedChatMode as any);
    }

    if (!selectedModel && settings.selectedModel) {
      setSelectedModel(settings.selectedModel);
    }
  }, [settings, setSelectedChatMode, setSelectedModel]);

  let chatId: number | undefined;

  // Track abort controllers for each chat to enable cancellation
  const abortControllersRef = useRef<Map<number, AbortController>>(new Map());

  if (hasChatId) {
    const searchParams = useSearchParams();
    chatId = searchParams.get("id")
      ? Number(searchParams.get("id"))
      : undefined;
  }
  let { refreshProposal } = hasChatId ? useProposal(chatId) : useProposal();

  const streamMessage = useCallback(
    async ({
      prompt,
      chatId,
      redo,
      attachments,
      selectedComponent,
      onSettled,
    }: {
      prompt: string;
      chatId: number;
      redo?: boolean;
      attachments?: FileAttachment[];
      selectedComponent?: ComponentSelection | null;
      onSettled?: () => void;
    }) => {
      if (
        (!prompt.trim() && (!attachments || attachments.length === 0)) ||
        !chatId
      ) {
        return;
      }

      setRecentStreamChatIds((prev) => {
        const next = new Set(prev);
        next.add(chatId);
        return next;
      });

      setErrorById((prev) => {
        const next = new Map(prev);
        next.set(chatId, null);
        return next;
      });
      setIsStreamingById((prev) => {
        const next = new Map(prev);
        next.set(chatId, true);
        return next;
      });

      let hasIncrementedStreamCount = false;
      let abortController: AbortController | null = null;

      try {
        const ipcClient = IpcClient.getInstance();

        // Use SSE streaming in web mode
        if (!ipcClient) {
          const { chatsApi } = await import("@/api/endpoints/chats");

          abortController = new AbortController();
          abortControllersRef.current.set(chatId, abortController);

          try {
            // First, create the user message
            const userMessage = await chatsApi.createMessage(chatId, {
              role: "user",
              content: prompt,
            });

            // Add user message to atom directly
            setMessagesById((prev) => {
              const currentMessages = prev.get(chatId) ?? [];
              const next = new Map(prev);
              // Check if message already exists to avoid duplicates
              const messageExists = currentMessages.some(
                (m) => m.id === userMessage.id,
              );
              if (!messageExists) {
                next.set(chatId, [...currentMessages, userMessage]);
              }
              return next;
            });

            // Create a temporary empty assistant message to show loading animation
            const tempAssistantMessageId = Date.now();

            // Add empty assistant message immediately for visual feedback (will trigger loading animation)
            setMessagesById((prev) => {
              const currentMessages = prev.get(chatId) ?? [];
              const next = new Map(prev);
              next.set(chatId, [
                ...currentMessages,
                {
                  id: tempAssistantMessageId,
                  chatId,
                  role: "assistant" as const,
                  content: "", // Empty content triggers the loading animation in ChatMessage
                  approvalState: null,
                  sourceCommitHash: null,
                  commitHash: null,
                  requestId: null,
                  createdAt: new Date(),
                },
              ]);
              return next;
            });

            // Increment stream count once
            if (!hasIncrementedStreamCount) {
              setStreamCountById((prev) => {
                const next = new Map(prev);
                next.set(chatId, (prev.get(chatId) ?? 0) + 1);
                return next;
              });
              hasIncrementedStreamCount = true;
            }

            // Start streaming the assistant response
            let streamingMessageId: number | null = null;

            // Map chatMode: "build" -> "auto-code", others remain the same
            const chatModeMap: Record<string, string> = {
              build: "auto-code",
              ask: "ask",
            };
            const chatMode = chatModeMap[selectedChatMode] || "auto-code";

            let modelPayload:
              | { id: string; name: string; providerId: string }
              | undefined;

            // Build modelPayload - always try to create it if selectedModel exists
            if (selectedModel) {
              // Handle both old format (id, name, provider) and new format (id, name, providerId)
              const modelId = (selectedModel as any).id || selectedModel.name;
              const modelName = selectedModel.name;
              let providerId =
                (selectedModel as any).providerId || selectedModel.provider;

              let displayName = modelName;
              let providerName = providerId; // Default to providerId if mapping fails
              
              // If we have a provider/providerId, try to enhance the data
              if (providerId) {
                // Try to get the provider name from providers data
                if (providers && providers.length > 0) {
                  const provider = providers.find(p => String(p.id) === String(providerId));
                  if (provider) {
                    providerName = provider.name; // Use provider name instead of ID
                  }
                }
                
                // Try to get the model display name from modelsByProviders if available
                if (modelsByProviders && modelsByProviders[providerId]) {
                  try {
                    const foundModel = modelsByProviders[providerId].find(
                      (model) => model.apiName === modelId,
                    );
                    if (foundModel) {
                      displayName = foundModel.displayName || displayName;
                    }
                  } catch {
                    // Error looking up model - continue with default name
                  }
                }
              }

              // Always create the modelPayload with all three fields
              if (modelId && modelName && providerId) {
                modelPayload = {
                  id: String(modelId),
                  name: displayName,
                  providerId: String(providerName), // Send provider name instead of ID
                };
              }
            }

            await chatsApi.streamChat(
              {
                chatId,
                messageId: userMessage.id,
                prompt,
                redo: redo ?? false,
                attachments: attachments ?? [],
                selectedComponent: selectedComponent ?? null,
                selectedModel: modelPayload,
                chatMode,
              },
              {
                onChunk: (chunk: string, fullText: string) => {
                  // Update messages with streaming content
                  setMessagesById((prev) => {
                    const currentMessages = prev.get(chatId) ?? [];
                    const next = new Map(prev);

                    // Check if we need to replace the temporary empty message or continue updating
                    const lastMsg = currentMessages.at(-1);
                    if (
                      lastMsg?.role === "assistant" &&
                      lastMsg?.id === tempAssistantMessageId &&
                      (streamingMessageId === null ||
                        streamingMessageId === tempAssistantMessageId)
                    ) {
                      // Replace the temporary empty message with streaming content
                      streamingMessageId = tempAssistantMessageId;
                      const updated = currentMessages.map((msg) =>
                        msg.id === tempAssistantMessageId
                          ? { ...msg, content: fullText }
                          : msg,
                      );
                      next.set(chatId, updated);
                    } else if (
                      streamingMessageId &&
                      lastMsg?.id === streamingMessageId
                    ) {
                      // Continue updating the streaming message
                      const updated = currentMessages.map((msg) =>
                        msg.id === streamingMessageId
                          ? { ...msg, content: fullText }
                          : msg,
                      );
                      next.set(chatId, updated);
                    }

                    return next;
                  });
                },
                onComplete: async (data: {
                  assistantMessageId: number;
                  fullText: string;
                  updatedFiles: boolean;
                  extraFiles?: any;
                  extraFilesError?: any;
                }) => {
                  // NOTE: Bypass proposal approval/rejection as of now - files should be visible immediately after chat completion

                  // Replace temporary message with real one
                  setMessagesById((prev) => {
                    const currentMessages = prev.get(chatId) ?? [];
                    const next = new Map(prev);

                    const filtered = currentMessages.filter(
                      (msg) =>
                        !(
                          msg.role === "assistant" &&
                          msg.id === streamingMessageId
                        ),
                    );

                    next.set(chatId, [
                      ...filtered,
                      {
                        id: data.assistantMessageId,
                        chatId,
                        role: "assistant" as const,
                        content: data.fullText,
                        approvalState: null,
                        sourceCommitHash: null,
                        commitHash: null,
                        requestId: null,
                        createdAt: new Date(),
                      },
                    ]);

                    return next;
                  });

                  // NOTE: Bypass proposal approval/rejection as of now - always open preview and refresh files
                  // Backend adds file details during chat response, so refreshApp() will fetch updated files
                  setIsPreviewOpen(true);

                  // Handle completion - refresh data
                  if (data.updatedFiles) {
                    refreshAppIframe();
                    if (settings?.enableAutoFixProblems) {
                      checkProblems();
                    }
                  }

                  if (data.extraFiles) {
                    showExtraFilesToast({
                      files: data.extraFiles,
                      error: data.extraFilesError,
                      posthog,
                    });
                  }

                  refreshProposal(chatId);
                  refetchUserBudget();

                  setIsStreamingById((prev) => {
                    const next = new Map(prev);
                    next.set(chatId, false);
                    return next;
                  });

                  refreshChats();

                  // Invalidate messages query to refetch from backend with persisted assistant message
                  await queryClient.invalidateQueries({
                    queryKey: ["chats", chatId, "messages"],
                    refetchType: "active",
                  });

                  // NOTE: Bypass proposal approval/rejection as of now - refreshApp fetches files from backend
                  await refreshApp();

                  // NOTE: Force CodeView to re-render and refetch file content by incrementing preview panel key
                  setPreviewPanelKey((prevKey) => prevKey + 1);

                  // refreshVersions();
                  countTokens(chatId, "");
                  onSettled?.();

                  // Sync files to Docker container after chat completion
                  // await syncToDocker();

                  // Cleanup abort controller
                  abortControllersRef.current.delete(chatId);
                },
                onError: (error: string) => {
                  console.error(`[CHAT] Stream error for ${chatId}:`, error);
                  setErrorById((prev) => {
                    const next = new Map(prev);
                    next.set(chatId, error);
                    return next;
                  });

                  setIsStreamingById((prev) => {
                    const next = new Map(prev);
                    next.set(chatId, false);
                    return next;
                  });

                  refreshChats();
                  refreshApp();
                  // refreshVersions();
                  countTokens(chatId, "");
                  onSettled?.();

                  // Cleanup abort controller
                  abortControllersRef.current.delete(chatId);
                },
              },
              abortController.signal,
            );
          } catch (error: any) {
            if (error.name !== "AbortError") {
              console.error("[CHAT] Error during streaming:", error);
              setErrorById((prev) => {
                const next = new Map(prev);
                next.set(chatId, error.message || "Failed to send message");
                return next;
              });
            }
            setIsStreamingById((prev) => {
              const next = new Map(prev);
              next.set(chatId, false);
              return next;
            });
          }

          return;
        }

        // IPC mode (Electron)
        (ipcClient as any).streamMessage(prompt, {
          selectedComponent: selectedComponent ?? null,
          chatId,
          redo,
          attachments,
          onUpdate: (updatedMessages: Message[]) => {
            if (!hasIncrementedStreamCount) {
              setStreamCountById((prev) => {
                const next = new Map(prev);
                next.set(chatId, (prev.get(chatId) ?? 0) + 1);
                return next;
              });
              hasIncrementedStreamCount = true;
            }

            setMessagesById((prev) => {
              const next = new Map(prev);
              next.set(chatId, updatedMessages);
              return next;
            });
          },
          onEnd: (response: ChatResponseEnd) => {
            if (response.updatedFiles) {
              setIsPreviewOpen(true);
              refreshAppIframe();
              if (settings?.enableAutoFixProblems) {
                checkProblems();
              }
            }
            if (response.extraFiles) {
              showExtraFilesToast({
                files: response.extraFiles,
                error: response.extraFilesError,
                posthog,
              });
            }
            refreshProposal(chatId);

            refetchUserBudget();

            // Keep the same as below
            setIsStreamingById((prev) => {
              const next = new Map(prev);
              next.set(chatId, false);
              return next;
            });
            refreshChats();
            refreshApp();
            // refreshVersions();
            countTokens(chatId, "");

            // Sync files to Docker container
            // if (selectedAppId) {
            //   import('@/api/endpoints/docker').then(({ dockerApi }) => {
            //     dockerApi.syncToDocker(selectedAppId).catch(err => {
            //       console.error('[Docker] Failed to sync after chat completion:', err);
            //     });
            //   });
            // }

            onSettled?.();
          },
          onError: (errorMessage: string) => {
            console.error(`[CHAT] Stream error for ${chatId}:`, errorMessage);
            setErrorById((prev) => {
              const next = new Map(prev);
              next.set(chatId, errorMessage);
              return next;
            });

            // Keep the same as above
            setIsStreamingById((prev) => {
              const next = new Map(prev);
              next.set(chatId, false);
              return next;
            });
            refreshChats();
            refreshApp();
            // refreshVersions();
            countTokens(chatId, "");
            onSettled?.();
          },
        });
      } catch (error) {
        console.error("[CHAT] Exception during streaming setup:", error);
        setIsStreamingById((prev) => {
          const next = new Map(prev);
          if (chatId) next.set(chatId, false);
          return next;
        });
        setErrorById((prev) => {
          const next = new Map(prev);
          if (chatId)
            next.set(
              chatId,
              error instanceof Error ? error.message : String(error),
            );
          return next;
        });
        onSettled?.();
      }
    },
    [
      setMessagesById,
      setIsStreamingById,
      setIsPreviewOpen,
      checkProblems,
      selectedAppId,
      refetchUserBudget,
      settings,
      selectedChatMode,
      selectedModel,
      modelsByProviders,
      providers,
      setErrorById,
      setRecentStreamChatIds,
      setStreamCountById,
      countTokens,
      refreshChats,
      refreshApp,
      refreshProposal,
      setPreviewPanelKey,
      refreshAppIframe,
      // syncToDocker,
      posthog,
    ],
  );

  const cancelStream = useCallback(
    (chatIdToCancel: number) => {
      const controller = abortControllersRef.current.get(chatIdToCancel);
      if (controller) {
        controller.abort();
        abortControllersRef.current.delete(chatIdToCancel);
        setIsStreamingById((prev) => {
          const next = new Map(prev);
          next.set(chatIdToCancel, false);
          return next;
        });
      }

      // Also try to cancel via IPC if in Electron mode
      try {
        const ipcClient = IpcClient.getInstance();
        if (ipcClient) {
          (ipcClient as any).cancelChatStream(chatIdToCancel);
        }
      } catch {
        // IPC not available in web mode
      }
    },
    [setIsStreamingById],
  );

  // NOTE: The chat streamining in chatpanel is not working properly with this code
  // Cleanup: Abort all active streams on component unmount
  // useEffect(() => {
  //   return () => {
  //     abortControllersRef.current.forEach((controller, chatId) => {
  //       controller.abort();
  //       setIsStreamingById((prev) => {
  //         const next = new Map(prev);
  //         next.set(chatId, false);
  //         return next;
  //       });
  //     });
  //     abortControllersRef.current.clear();
  //   };
  // }, []); // Empty deps - only run cleanup on unmount, not on every state change

  return {
    streamMessage,
    cancelStream,
    isStreaming:
      hasChatId && chatId !== undefined
        ? (isStreamingById.get(chatId) ?? false)
        : false,
    error:
      hasChatId && chatId !== undefined
        ? (errorById.get(chatId) ?? null)
        : null,
    setError: (value: string | null) =>
      setErrorById((prev) => {
        const next = new Map(prev);
        if (chatId !== undefined) next.set(chatId, value);
        return next;
      }),
    setIsStreaming: (value: boolean) =>
      setIsStreamingById((prev) => {
        const next = new Map(prev);
        if (chatId !== undefined) next.set(chatId, value);
        return next;
      }),
  };
}
