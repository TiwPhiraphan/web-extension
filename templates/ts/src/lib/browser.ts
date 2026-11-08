/**
 * Cross-browser WebExtension API accessor.
 * Supports standard browser.* and chrome.* namespaces.
 */
export const api: typeof chrome =
  typeof (globalThis as any).browser !== 'undefined'
    ? (globalThis as any).browser
    : (globalThis as any).chrome;

