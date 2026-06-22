import { useCallback, useEffect, useState } from 'react';
import { IS_FIREFOX } from '@/shared/constants/browser.js';
import { sendMessage } from '@/shared/messaging.js';

/**
 * Доступ к хостам VK для ФОНОВЫХ запросов. В Firefox MV3 host_permissions
 * опциональны — пока пользователь не выдаст доступ, фоновые запросы к api.vk.com
 * молча падают (CORS). На Chromium доступ выдаётся при установке, так что хук —
 * фактически no-op (granted=true).
 *
 * Origins зеркалят host_permissions из manifest/base.json.
 */
// Запрашиваем весь набор (чтобы заработало всё), а проверяем по ключевым для
// фоновых функций хостам. ВАЖНО: схема должна совпадать с манифестом (`https://`,
// не `*://`) — иначе permissions.contains вернёт false даже при выданном доступе.
const HOST_ORIGINS = [
  'https://*.vk.com/*',
  'https://*.vk.ru/*',
  'https://vkvideo.ru/*',
  'https://api.vk.com/*',
  'https://api.vk.ru/*',
  // Аудио-CDN VK: фоновое скачивание музыки (HLS) в Firefox.
  'https://*.vkuseraudio.net/*',
];
/** Подмножество для проверки «доступ есть?» — то же используется в background (PING). */
const HOST_CHECK = ['https://*.vk.com/*', 'https://api.vk.com/*'];

export interface HostPermissionHook {
  /** null — ещё проверяем; true/false — результат. */
  granted: boolean | null;
  /** Только Firefox: имеет смысл показывать онбординг доступа. */
  needsGrant: boolean;
  /** Запросить доступ (требует user gesture). Возвращает, выдан ли он. */
  request: () => Promise<boolean>;
}

export function useHostPermission(): HostPermissionHook {
  const [granted, setGranted] = useState<boolean | null>(IS_FIREFOX ? null : true);

  const check = useCallback(async (): Promise<void> => {
    if (!IS_FIREFOX) { setGranted(true); return; }
    // В обычном попапе есть chrome.permissions; во встроенном iframe — может не
    // быть, тогда спрашиваем background (PING возвращает статус доступа).
    if (chrome.permissions?.contains) {
      try { setGranted(await chrome.permissions.contains({ origins: HOST_CHECK })); return; }
      catch { /* упадём на фолбэк */ }
    }
    try {
      const r = await sendMessage({ type: 'PING' });
      setGranted(r?.hasVKHostPermission ?? true);
    } catch {
      setGranted(true); // не смогли проверить — не пугаем баннером
    }
  }, []);

  useEffect(() => { void check(); }, [check]);

  const request = useCallback(async (): Promise<boolean> => {
    if (!chrome.permissions?.request) return false;
    try {
      const ok = await chrome.permissions.request({ origins: HOST_ORIGINS });
      if (ok) setGranted(true);
      return ok;
    } catch {
      return false;
    }
  }, []);

  return {
    granted,
    needsGrant: IS_FIREFOX && granted === false,
    request,
  };
}
