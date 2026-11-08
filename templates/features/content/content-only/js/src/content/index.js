console.log('{{name}} content script (DOM injector) initialized on', window.location.href);

function initDomHacks() {
  const badge = document.createElement('div');
  badge.className = 'we-injected-badge';
  badge.textContent = '{{name}} Active';
  document.body.appendChild(badge);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener(
    'pagehide',
    () => {
      observer.disconnect();
    },
    { once: true }
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDomHacks);
} else {
  initDomHacks();
}

