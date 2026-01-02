import sanitizeHtml from 'sanitize-html';
/**
 * Sanitize user input to prevent XSS and code injection.
 * Use this before processing or storing any prompt or user-supplied string.
 */
export function sanitizePromptInput(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
  });
}
