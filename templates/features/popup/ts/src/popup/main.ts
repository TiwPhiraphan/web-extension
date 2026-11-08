import { api } from '../lib/browser';

document.getElementById('btn')?.addEventListener('click', () => {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = 'Button clicked!';
  }
});

