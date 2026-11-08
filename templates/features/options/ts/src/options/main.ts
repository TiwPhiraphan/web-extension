import { api } from '../lib/browser';

const checkbox = document.getElementById('enabled') as HTMLInputElement | null;
const status = document.getElementById('status');

checkbox?.addEventListener('change', () => {
  if (status) {
    status.textContent = checkbox.checked ? 'Setting enabled' : 'Setting disabled';
  }
});

