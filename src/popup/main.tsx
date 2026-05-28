import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import './index.css';

if (new URLSearchParams(location.search).has('embed')) {
  document.documentElement.classList.add('vkify-embedded');

  let lastH = 0;
  let scheduled = false;

  const sendHeight = (): void => {
    const h = document.body.scrollHeight;
    if (h < 1 || h === lastH) return;
    lastH = h;
    window.parent.postMessage({ type: 'VKIFY_EMBED_HEIGHT', height: h }, '*');
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      sendHeight();
      requestAnimationFrame(() => {
        scheduled = false;
        sendHeight();
      });
    });
  };

  const bind = (): void => {
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true });
    schedule();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);