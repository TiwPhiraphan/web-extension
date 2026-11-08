import { api } from '../lib/browser.js';

const checkbox = /** @type {HTMLInputElement | null} */ (document.getElementById('enabled'));
const status = document.getElementById('status');

checkbox?.addEventListener('change', () => {
  if (status) {
    status.textContent = checkbox.checked ? 'Setting enabled' : 'Setting disabled';
  }
});

