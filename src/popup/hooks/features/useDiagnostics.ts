import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('modals');
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
    add('engine', t('diag.labels.engine'), engineMatch ? 'ok' : 'warn',
      t('diag.detail.engine', { build: BROWSER, runtime: engine }) + (engineMatch ? '' : t('diag.detail.engine_mismatch')));

    // 2. Нормализация chrome.* (на Firefox alias chrome→browser).
    const apiOk = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
    add('api', t('diag.labels.api'), apiOk ? 'ok' : 'fail',
      apiOk ? (IS_FIREFOX ? t('diag.detail.api_ok_ff') : t('diag.detail.api_ok')) : t('diag.detail.api_fail'));

    // 3. Контекст попапа: отдельное окно или встроенный iframe.
    const embedded = new URLSearchParams(location.search).has('embed')
      || document.documentElement.classList.contains('vkify-embedded');
    add('context', t('diag.labels.context'), 'info',
      embedded ? t('diag.detail.context_embed') : t('diag.detail.context_window'));

    // 4. chrome.tabs в этом контексте (в Firefox embed его нет — это норма).
    // Проверяем наличие неймспейса, а не метода (чтобы не дёргать сам API).
    const tabsHere = typeof chrome !== 'undefined' && !!chrome.tabs;
    add('tabs', t('diag.labels.tabs'), tabsHere ? 'ok' : 'info',
      tabsHere ? t('diag.detail.tabs_ok') : t('diag.detail.tabs_info'));

    // 5. Background жив + 6. host-permission (один PING).
    try {
      const r = await sendMessage({ type: 'PING' });
      add('bg', t('diag.labels.bg'), r?.pong ? 'ok' : 'fail', r?.pong ? t('diag.detail.bg_ok') : t('diag.detail.bg_fail'));
      add('host', t('diag.labels.host'),
        r?.hasVKHostPermission ? 'ok' : 'warn',
        r?.hasVKHostPermission ? t('diag.detail.host_ok') : t('diag.detail.host_warn'));
    } catch {
      add('bg', t('diag.labels.bg'), 'fail', t('diag.detail.bg_no_ping'));
      add('host', t('diag.labels.host'), 'warn', t('diag.detail.host_uncheck'));
    }

    // 7. Открыта ли вкладка VK.
    const vkTabs = await countVKTabs();
    add('vktab', t('diag.labels.vktab'), vkTabs > 0 ? 'ok' : 'info',
      vkTabs > 0 ? t('diag.detail.vktab_open', { count: vkTabs }) : t('diag.detail.vktab_none'));

    // 8. Content-скрипт на VK-вкладке отвечает + метод API.
    try {
      const m = await sendMessage({ type: 'GET_API_METHOD' });
      if (!m?.hasVKTab) {
        add('content', t('diag.labels.content'), 'info', t('diag.detail.content_no_tab'));
      } else if (m.nativeApiAvailable) {
        add('content', t('diag.labels.content'), 'ok', t('diag.detail.content_native'));
      } else if (m.hasToken) {
        add('content', t('diag.labels.content'), 'ok', t('diag.detail.content_token'));
      } else {
        add('content', t('diag.labels.content'), 'warn', t('diag.detail.content_no_api'));
      }
    } catch {
      add('content', t('diag.labels.content'), 'warn', t('diag.detail.content_no_resp'));
    }

    // 9. Доступность storage — пробник через storageClient (тонкий passthrough
    // к chrome.storage.local; если API недоступен, getStorage бросит так же).
    try {
      await getStorage(['__vkify_diag_probe__']);
      add('storage', t('diag.labels.storage'), 'ok', t('diag.detail.storage_ok'));
    } catch (e) {
      add('storage', t('diag.labels.storage'), 'fail', (e as Error).message);
    }

    setItems(next);
    setLoading(false);
  }, [t]);

  useEffect(() => { void run(); }, [run]);

  return { items, loading, run };
}
