import { useState, useEffect, useCallback } from "react";
import { proposalResultAtom } from "@/atoms/proposalAtoms";
import { useAtom } from "jotai";
import { parseProposalFromMessage } from "@/lib/proposal-parser";
import { useQueryClient } from "@tanstack/react-query";
import { chatsKeys } from "./useChats";

export function useProposal(chatId?: number | undefined) {
  const [proposalResult, setProposalResult] = useAtom(proposalResultAtom);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const fetchProposal = useCallback(
    async (overrideChatId?: number) => {
      chatId = overrideChatId ?? chatId;
      if (chatId === undefined) {
        setProposalResult(null);
        setIsLoading(false);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        // NOTE: Proposal parser at client side
        // Get messages from React Query cache instead of making new API call
        const messages =
          queryClient.getQueryData<any[]>([
            ...chatsKeys.detail(chatId),
            "messages",
          ]) || [];

        // Find the last assistant message that hasn't been approved/rejected
        const lastAssistantMessage = messages
          .filter((msg) => msg.role === "assistant" && !msg.approvalState)
          .pop();

        if (!lastAssistantMessage) {
          setProposalResult(null);
          setIsLoading(false);
          return;
        }

        // Parse the message content to extract proposal
        const proposal = parseProposalFromMessage(lastAssistantMessage.content);

        if (proposal) {
          setProposalResult({
            proposal,
            chatId,
            messageId: lastAssistantMessage.id,
          });
        } else {
          setProposalResult(null);
        }
      } catch (err: any) {
        console.error("Error fetching proposal:", err);
        setError(err.message || "Failed to fetch proposal");
        setProposalResult(null);
      } finally {
        setIsLoading(false);
      }
    },
    [chatId, setProposalResult, queryClient],
  );

  useEffect(() => {
    fetchProposal();

    // Cleanup function if needed (e.g., for aborting requests)
    // return () => {
    //   // Abort logic here
    // };
  }, [fetchProposal]); // Re-run effect if fetchProposal changes (due to chatId change)

  return {
    proposalResult: proposalResult,
    isLoading,
    error,
    refreshProposal: fetchProposal, // Expose the refresh function
  };
}
