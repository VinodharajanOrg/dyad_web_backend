// NOTE: Proposal parser at client side
// Applies parsed dyad-write tags by writing files via API

import { filesApi } from "@/api/endpoints/files";
import {
  getDyadWriteTags,
  getDyadDeleteTags,
  getDyadRenameTags,
} from "./proposal-parser";

interface ApplyProposalResult {
  success: boolean;
  filesWritten: string[];
  filesDeleted: string[];
  filesRenamed: Array<{ from: string; to: string }>;
  errors: string[];
}

/**
 * Apply a proposal by writing/deleting/renaming files via the backend API
 */
export async function applyProposal(
  appId: number,
  messageContent: string,
): Promise<ApplyProposalResult> {
  const result: ApplyProposalResult = {
    success: true,
    filesWritten: [],
    filesDeleted: [],
    filesRenamed: [],
    errors: [],
  };

  try {
    // Parse all tags from the message
    const writeTags = getDyadWriteTags(messageContent);
    const deleteTags = getDyadDeleteTags(messageContent);
    const renameTags = getDyadRenameTags(messageContent);

    // Apply write operations
    for (const tag of writeTags) {
      try {
        await filesApi.writeFile(appId, tag.path, tag.content);
        result.filesWritten.push(tag.path);
      } catch (err: any) {
        const errorMsg = `Failed to write ${tag.path}: ${err.message}`;
        result.errors.push(errorMsg);
        result.success = false;
      }
    }

    // Apply delete operations
    for (const tag of deleteTags) {
      try {
        await filesApi.deleteFile(appId, tag.path);
        result.filesDeleted.push(tag.path);
      } catch (err: any) {
        const errorMsg = `Failed to delete ${tag.path}: ${err.message}`;
        result.errors.push(errorMsg);
        result.success = false;
        console.error(`[Proposal Applier] ${errorMsg}`, err);
      }
    }

    // Apply rename operations
    // Note: This requires reading the file, writing to new location, and deleting old
    for (const tag of renameTags) {
      try {
        // Read the original file
        const content = await filesApi.readFile(appId, tag.from);

        // Write to new location
        await filesApi.writeFile(appId, tag.to, content);

        // Delete original file
        await filesApi.deleteFile(appId, tag.from);

        result.filesRenamed.push({ from: tag.from, to: tag.to });
      } catch (err: any) {
        const errorMsg = `Failed to rename ${tag.from} to ${tag.to}: ${err.message}`;
        result.errors.push(errorMsg);
        result.success = false;
        console.error(`[Proposal Applier] ${errorMsg}`, err);
      }
    }
  } catch (err: any) {
    result.success = false;
    result.errors.push(`Unexpected error: ${err.message}`);
    console.error("[Proposal Applier] Unexpected error:", err);
  }

  return result;
}
