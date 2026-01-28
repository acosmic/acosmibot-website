// ===== DOCS INITIALIZATION =====
// Bootstraps the documentation SPA

console.log('docs-init.js loading...');

(async function initDocs() {
  console.log('Initializing Documentation SPA...');

  // Wait for DocsCore and DocsRouter to be available
  await waitFor(() => window.DocsCore && window.DocsRouter && window.ViewManager);

  // Initialize router
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
