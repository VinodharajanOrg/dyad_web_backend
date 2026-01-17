/**
 * Opens an external URL in the browser.
 */
export function openExternalUrl(url: string): void {
  // Web mode: always open in new tab with security flags
  window.open(url, "_blank", "noopener,noreferrer");
}
