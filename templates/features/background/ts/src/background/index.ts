import { api } from '../lib/browser';

api.runtime.onInstalled.addListener((details) => {
  console.log('{{name}} extension installed or updated:', details.reason);
});

