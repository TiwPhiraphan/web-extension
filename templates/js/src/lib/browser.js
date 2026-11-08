/**
 * Cross-browser WebExtension API accessor.
 * Supports standard browser.* and chrome.* namespaces.
 */
export const api =
  typeof globalThis.browser !== 'undefined'
    ? globalThis.browser
    : globalThis.chrome;

