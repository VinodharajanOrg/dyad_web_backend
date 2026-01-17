// NOTE: Proposal parser at client side
// Parses dyad-write and other tags from AI responses to build proposals

import type {
  CodeProposal,
  FileChange,
  SecurityRisk,
  SqlQuery,
} from "./schemas";

interface DyadWriteTag {
  path: string;
  description: string;
  content: string;
}

interface DyadDeleteTag {
  path: string;
}

interface DyadRenameTag {
  from: string;
  to: string;
}

interface DyadAddDependencyTag {
  packages: string[];
}

interface DyadExecuteSqlTag {
  content: string;
  description?: string;
}

/**
 * Extract dyad-write tags from message content
 */
export function getDyadWriteTags(content: string): DyadWriteTag[] {
  const tags: DyadWriteTag[] = [];
  // Match <dyad-write path="..." description="...">content</dyad-write>
  const regex =
    /<dyad-write\s+path="([^"]+)"(?:\s+description="([^"]*)")?\s*>([\s\S]*?)<\/dyad-write>/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.push({
      path: match[1],
      description: match[2] || "",
      content: match[3],
    });
  }

  return tags;
}

/**
 * Extract dyad-delete tags from message content
 */
export function getDyadDeleteTags(content: string): DyadDeleteTag[] {
  const tags: DyadDeleteTag[] = [];
  // Match <dyad-delete path="..."></dyad-delete> or <dyad-delete path="..." />
  const regex = /<dyad-delete\s+path="([^"]+)"\s*(?:\/>|><\/dyad-delete>)/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.push({
      path: match[1],
    });
  }

  return tags;
}

/**
 * Extract dyad-rename tags from message content
 */
export function getDyadRenameTags(content: string): DyadRenameTag[] {
  const tags: DyadRenameTag[] = [];
  // Match <dyad-rename from="..." to="..."></dyad-rename> or <dyad-rename from="..." to="..." />
  const regex =
    /<dyad-rename\s+from="([^"]+)"\s+to="([^"]+)"\s*(?:\/>|><\/dyad-rename>)/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.push({
      from: match[1],
      to: match[2],
    });
  }

  return tags;
}

/**
 * Extract dyad-add-dependency tags from message content
 */
export function getDyadAddDependencyTags(
  content: string,
): DyadAddDependencyTag[] {
  const tags: DyadAddDependencyTag[] = [];
  // Match <dyad-add-dependency packages="..."></dyad-add-dependency> or <dyad-add-dependency packages="..." />
  const regex =
    /<dyad-add-dependency\s+packages="([^"]+)"\s*(?:\/>|><\/dyad-add-dependency>)/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const packages = match[1].split(/\s+/).filter(Boolean);
    tags.push({ packages });
  }

  return tags;
}

/**
 * Extract dyad-execute-sql tags from message content
 */
export function getDyadExecuteSqlTags(content: string): DyadExecuteSqlTag[] {
  const tags: DyadExecuteSqlTag[] = [];
  // Match <dyad-execute-sql description="...">SQL</dyad-execute-sql>
  const regex =
    /<dyad-execute-sql(?:\s+description="([^"]*)")?\s*>([\s\S]*?)<\/dyad-execute-sql>/gi;

  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.push({
      content: match[2],
      description: match[1],
    });
  }

  return tags;
}

/**
 * Detect potential security risks in code
 */
export function detectSecurityRisks(tags: DyadWriteTag[]): SecurityRisk[] {
  const risks: SecurityRisk[] = [];

  for (const tag of tags) {
    const content = tag.content;

    // Check for environment variable access
    if (
      content.includes("process.env") ||
      content.includes("import.meta.env")
    ) {
      risks.push({
        type: "warning",
        title: "Environment Variable Access",
        description: `File "${tag.path}" accesses environment variables. Ensure sensitive data is properly secured.`,
      });
    }

    // Check for eval or dangerous functions
    if (
      content.includes("eval(") ||
      content.includes("Function(") ||
      content.includes("dangerouslySetInnerHTML")
    ) {
      risks.push({
        type: "danger",
        title: "Potentially Dangerous Code",
        description: `File "${tag.path}" contains potentially dangerous code patterns (eval, Function, or dangerouslySetInnerHTML).`,
      });
    }

    // Check for file system access
    if (
      content.includes("fs.") ||
      content.includes("require('fs')") ||
      content.includes("import fs")
    ) {
      risks.push({
        type: "warning",
        title: "File System Access",
        description: `File "${tag.path}" accesses the file system. This may not work in browser environments.`,
      });
    }
  }

  return risks;
}

/**
 * Parse message content and build a CodeProposal
 */
export function parseProposalFromMessage(
  messageContent: string,
): CodeProposal | null {
  const writeTags = getDyadWriteTags(messageContent);
  const deleteTags = getDyadDeleteTags(messageContent);
  const renameTags = getDyadRenameTags(messageContent);
  const dependencyTags = getDyadAddDependencyTags(messageContent);
  const sqlTags = getDyadExecuteSqlTags(messageContent);

  // If no code changes detected, return null
  if (
    writeTags.length === 0 &&
    deleteTags.length === 0 &&
    renameTags.length === 0 &&
    dependencyTags.length === 0 &&
    sqlTags.length === 0
  ) {
    return null;
  }

  // Build filesChanged array
  const filesChanged: FileChange[] = [];

  // Add write operations
  for (const tag of writeTags) {
    const fileName = tag.path.split("/").pop() || tag.path;
    const isServerFunction =
      tag.path.includes("supabase/functions") ||
      tag.path.includes("netlify/functions");

    filesChanged.push({
      name: fileName,
      path: tag.path,
      summary: tag.description || `Writing ${fileName}`,
      type: "write",
      isServerFunction,
    });
  }

  // Add delete operations
  for (const tag of deleteTags) {
    const fileName = tag.path.split("/").pop() || tag.path;

    filesChanged.push({
      name: fileName,
      path: tag.path,
      summary: `Deleting ${fileName}`,
      type: "delete",
      isServerFunction: false,
    });
  }

  // Add rename operations
  for (const tag of renameTags) {
    const oldName = tag.from.split("/").pop() || tag.from;
    const newName = tag.to.split("/").pop() || tag.to;

    filesChanged.push({
      name: oldName,
      path: tag.from,
      summary: `Renaming ${oldName} to ${newName}`,
      type: "rename",
      isServerFunction: false,
    });
  }

  // Collect all packages to add
  const packagesAdded: string[] = [];
  for (const tag of dependencyTags) {
    packagesAdded.push(...tag.packages);
  }

  // Convert SQL tags to SqlQuery format
  const sqlQueries: SqlQuery[] = sqlTags.map((tag) => ({
    content: tag.content,
    description: tag.description,
  }));

  // Detect security risks
  const securityRisks = detectSecurityRisks(writeTags);

  // Extract title from dyad-chat-summary if present
  const titleMatch = messageContent.match(
    /<dyad-chat-summary>(.*?)<\/dyad-chat-summary>/i,
  );
  const title = titleMatch ? titleMatch[1] : generateDefaultTitle(filesChanged);

  return {
    type: "code-proposal",
    title,
    securityRisks,
    filesChanged,
    packagesAdded,
    sqlQueries,
  };
}

/**
 * Generate a default title based on file changes
 */
function generateDefaultTitle(filesChanged: FileChange[]): string {
  if (filesChanged.length === 0) return "Code changes";
  if (filesChanged.length === 1) {
    const file = filesChanged[0];
    return (
      file.summary ||
      `${file.type === "write" ? "Create" : file.type === "delete" ? "Delete" : "Rename"} ${file.name}`
    );
  }
  return `Update ${filesChanged.length} files`;
}
