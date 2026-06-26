import { useCallback, useEffect, useState } from 'react';
import { BROWSER, IS_FIREFOX } from '@/shared/constants/browser.js';
import { sendMessage } from '@/shared/messaging.js';
import { countVKTabs } from '../../utils/tabs.js';
import { getStorage } from '../../utils/storageClient.js';

export type DiagStatus = 'ok' | 'warn' | 'fail' | 'info';

export interface DiagItem {
  id: string;
  label: string;
  status: DiagStatus;
  detail: string;
}

export interface DiagnosticsHook {
  items: DiagItem[];
  loading: boolean;
  run: () => Promise<void>;
}

function detectEngine(): 'firefox' | 'opera' | 'chromium' {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/OPR\//.test(ua)) return 'opera';
  return 'chromium';
}

/**
 * Самодиагностика расширения: прогоняет проверки по тем местам, где у MV3 /
 * кросс-браузерности / CSP тонкие режимы отказа, и возвращает health-отчёт.
 * Каждая проверка изолирована (никогда не бросает) — отказ одной не валит панель.
 */
export function useDiagnostics(): DiagnosticsHook {
  const [items, setItems] = useState<DiagItem[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (): Promise<void> => {
    setLoading(true);
    const next: DiagItem[] = [];
    const add = (id: string, label: string, status: DiagStatus, detail: string): void => {
      next.push({ id, label, status, detail });
    };

    // 1. Движок: сборка vs реальный UA.
    const engine = detectEngine();
    const engineMatch = BROWSER === engine || (BROWSER !== 'firefox' && engine !== 'firefox');
    add('engine', 'Движок', engineMatch ? 'ok' : 'warn',
      `сборка: ${BROWSER}, рантайм: ${engine}${engineMatch ? '' : ' — сборка не для этого браузера'}`);

    // 2. Нормализация chrome.* (на Firefox alias chrome→browser).
    const apiOk = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
    add('api', 'API расширения', apiOk ? 'ok' : 'fail',
      apiOk ? `chrome.* активен${IS_FIREFOX ? ' (alias на browser)' : ''}` : 'chrome.runtime недоступен');

    // 3. Контекст попапа: отдельное окно или встроенный iframe.
    const embedded = new URLSearchParams(location.search).has('embed')
      || document.documentElement.classList.contains('vkify-embedded');
    add('context', 'Контекст', 'info',
      embedded ? 'встроенная панель (vk.com/vkify_settings)' : 'отдельное окно попапа');

    // 4. chrome.tabs в этом контексте (в Firefox embed его нет — это норма).
    // Проверяем наличие неймспейса, а не метода (чтобы не дёргать сам API).
    const tabsHere = typeof chrome !== 'undefined' && !!chrome.tabs;
    add('tabs', 'chrome.tabs здесь', tabsHere ? 'ok' : 'info',
      tabsHere ? 'доступен напрямую' : 'недоступен (ожидаемо в embed) — операции идут через background');

    // 5. Background жив + 6. host-permission (один PING).
    try {
      const r = await sendMessage({ type: 'PING' });
      add('bg', 'Background', r?.pong ? 'ok' : 'fail', r?.pong ? 'отвечает' : 'нет ответа');
      add('host', 'Доступ к vk.com (host permission)',
        r?.hasVKHostPermission ? 'ok' : 'warn',
        r?.hasVKHostPermission ? 'выдан'
          : 'не выдан — в Firefox разрешите доступ к сайту (значок расширения / about:addons)');
    } catch {
      add('bg', 'Background', 'fail', 'не отвечает на PING');
      add('host', 'Доступ к vk.com (host permission)', 'warn', 'не удалось проверить');
    }

    // 7. Открыта ли вкладка VK.
    const vkTabs = await countVKTabs();
    add('vktab', 'Вкладка VK', vkTabs > 0 ? 'ok' : 'info',
      vkTabs > 0 ? `открыто: ${vkTabs}` : 'нет открытых вкладок vk.com');

    // 8. Content-скрипт на VK-вкладке отвечает + метод API.
    try {
      const m = await sendMessage({ type: 'GET_API_METHOD' });
      if (!m?.hasVKTab) {
        add('content', 'Content-скрипт', 'info', 'нет вкладки VK для проверки');
      } else if (m.nativeApiAvailable) {
        add('content', 'Content-скрипт', 'ok', 'отвечает · метод API: native');
      } else if (m.hasToken) {
        add('content', 'Content-скрипт', 'ok', 'отвечает · метод API: token');
      } else {
        add('content', 'Content-скрипт', 'warn', 'отвечает, но API недоступен (нет токена)');
      }
    } catch {
      add('content', 'Content-скрипт', 'warn', 'нет ответа от вкладки VK');
    }

    // 9. Доступность storage — пробник через storageClient (тонкий passthrough
    // к chrome.storage.local; если API недоступен, getStorage бросит так же).
    try {
      await getStorage(['__vkify_diag_probe__']);
      add('storage', 'Хранилище', 'ok', 'chrome.storage.local доступен');
    } catch (e) {
      add('storage', 'Хранилище', 'fail', (e as Error).message);
    }

    setItems(next);
    setLoading(false);
  }, []);

  useEffect(() => { void run(); }, [run]);

  return { items, loading, run };
}
