console.log('{{name}} content script (DOM injector) initialized on', window.location.href);

function initDomHacks() {
  // 1. Wait for DOM ready, then inject a small floating badge element
  const badge = document.createElement('div');
  badge.className = 'we-injected-badge';
  badge.textContent = '{{name}} Active';
  document.body.appendChild(badge);

  // 2. Setup MutationObserver to watch dynamic DOM changes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        // Handle dynamically added nodes if needed
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Disconnect observer on page unload / cleanup
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

