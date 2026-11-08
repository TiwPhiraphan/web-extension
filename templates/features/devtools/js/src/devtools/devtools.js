import { api } from '../lib/browser.js';

api.devtools?.panels?.create(
  '{{name}}',
  'icons/16.png',
  'src/devtools/panel.html',
  () => {
    console.log('DevTools panel created');
  }
);

