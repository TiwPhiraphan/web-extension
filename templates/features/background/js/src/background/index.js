import { api } from '../lib/browser.js';

api.runtime.onInstalled.addListener((details) => {
  console.log('{{name}} extension installed or updated:', details.reason);
});

