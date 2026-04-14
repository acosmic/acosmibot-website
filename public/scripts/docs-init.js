// ===== DOCS INITIALIZATION =====
// Bootstraps the documentation SPA

console.log('docs-init.js loading...');

(async function initDocs() {
  console.log('Initializing Documentation SPA...');

  // Wait for DocsCore and DocsRouter to be available
  await waitFor(() => window.DocsCore && window.DocsRouter && window.ViewManager);

  // Check for redirect from 404.html (GitHub Pages SPA routing)
  const redirectPath = sessionStorage.getItem('docs_spa_redirect');
  if (redirectPath) {
    console.log('Restoring path from 404 redirect:', redirectPath);
    sessionStorage.removeItem('docs_spa_redirect');
    history.replaceState(null, '', redirectPath);
  }

  // Parse initial section from URL
  const pathParts = window.location.pathname.split('/').filter(p => p);
  const initialSection = (pathParts[0] === 'docs' && pathParts[1]) ? pathParts[1] : 'introduction';

  // Initialize DocsCore FIRST (loads auth, user, guilds)
  await window.DocsCore.init(initialSection);

  // Then initialize router
  window.DocsRouter.init();

  console.log('Documentation SPA initialized successfully!');
})();

// Helper function to wait for conditions
function waitFor(condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(check, 50);
      }
    };

    check();
  });
}
