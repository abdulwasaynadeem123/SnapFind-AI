import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { runLightweightOAuthPopupCallback } from './services/oauthPopupCallback';

const rootEl = document.getElementById('root');
if (rootEl) {
  const handledAsOAuthPopup = runLightweightOAuthPopupCallback(rootEl);
  if (!handledAsOAuthPopup) {
    Promise.all([
      import('./App.tsx'),
      import('./components/ErrorBoundary'),
      import('./index.css'),
    ]).then(([{ default: App }, { ErrorBoundary }]) => {
      createRoot(rootEl).render(
        <StrictMode>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StrictMode>,
      );
      if (typeof (window as any).__SNAPFIND_MOUNTED__ === 'function') {
        (window as any).__SNAPFIND_MOUNTED__();
      }
    });
  } else if (typeof (window as any).__SNAPFIND_MOUNTED__ === 'function') {
    (window as any).__SNAPFIND_MOUNTED__();
  }
}
