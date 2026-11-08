import { api } from '../lib/browser';

console.log('{{name}} content script loaded on', window.location.href);

// Example: Send message to background service worker / background script
api.runtime?.sendMessage?.({ type: 'CONTENT_LOADED', url: window.location.href }).catch(() => {
  // Ignored if background listener is not active
});

