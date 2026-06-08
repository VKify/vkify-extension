import { installExtApi } from '../shared/ext-api.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { setEmbedViewport } from './utils/embedViewport.js';
import { bootstrapPopupThemeFromCache } from './utils/themePalette.js';
import './index.css';

installExtApi(); // cross-browser chrome/browser normalisation — before any chrome.* call

// Применяем кэш выбранной VK-темы синхронно, до первого кадра — чтобы окно
// сразу открывалось в цветах темы, без вспышки дефолтного фона.
bootstrapPopupThemeFromCache();

if (new URLSearchParams(location.search).has('embed')) {
  document.documentElement.classList.add('vkify-embedded');

  // Видимая полоса iframe от content-script'а — для центрирования модалок.
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { type?: string; top?: number; height?: number } | null;
    if (!d || d.type !== 'VKIFY_EMBED_VIEWPORT') return;
    if (typeof d.top !== 'number' || typeof d.height !== 'number' || d.height < 1) return;
    setEmbedViewport({ top: d.top, height: d.height });
  });

  let lastH = 0;
  let scheduled = false;
  let shrinkTimer = 0;

  // Задержка сжатия. При переключении вкладок TabContent на миг показывает
  // Suspense-спиннер (низкий), высота падает и тут же вырастает обратно —
  // без задержки iframe «схлопывался» и подпрыгивал. Рост применяем сразу,
  // сжатие — только если высота продержалась меньшей этот интервал.
  const SHRINK_DELAY_MS = 160;

  const post = (h: number): void => {
    lastH = h;
    window.parent.postMessage({ type: 'VKIFY_EMBED_HEIGHT', height: h }, '*');
  };

  const sendHeight = (): void => {
    const h = document.body.scrollHeight;
    if (h < 1 || h === lastH) return;

    if (h > lastH) {
      // Рост — сразу, и отменяем отложенное сжатие (контент вернулся выше).
      clearTimeout(shrinkTimer);
      shrinkTimer = 0;
      post(h);
      return;
    }

    // Сжатие — откладываем; если за это время высота снова вырастет, отменим.
    clearTimeout(shrinkTimer);
    shrinkTimer = window.setTimeout(() => {
      const cur = document.body.scrollHeight;
      if (cur >= 1 && cur < lastH) post(cur);
    }, SHRINK_DELAY_MS);
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