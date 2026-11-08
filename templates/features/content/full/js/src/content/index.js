import { api } from '../lib/browser.js';

console.log('{{name}} content script loaded on', window.location.href);

api.runtime?.sendMessage?.({ type: 'CONTENT_LOADED', url: window.location.href }).catch(() => {});

