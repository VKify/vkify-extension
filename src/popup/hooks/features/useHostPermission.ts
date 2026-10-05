import { useCallback, useEffect, useState } from 'react';
import { IS_FIREFOX } from '@/shared/constants/browser.js';
import { sendMessage } from '@/shared/messaging.js';
import { VK_BACKGROUND_HOST_ORIGINS } from '@/shared/constants/host-permissions.js';

/**
 * Доступ к хостам VK для ФОНОВЫХ запросов. В Firefox MV3 host_permissions
 * опциональны — пока пользователь не выдаст доступ, фоновые запросы к api.vk.ru
 * молча падают (CORS). На Chromium доступ выдаётся при установке, так что хук —
 * фактически no-op (granted=true).
 *
 * Origins зеркалят host_permissions из manifest/base.json.
 */
// Проверка и запрос включают CDN: доступ к странице VK ещё не даёт фоновой
// загрузке музыки доступ к плейлистам, сегментам и ключам на других хостах.

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
      try { setGranted(await chrome.permissions.contains({ origins: VK_BACKGROUND_HOST_ORIGINS })); return; }
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
    // permissions.request НЕ поддерживается в Firefox for Android (addons-linter
    // ANDROID_INCOMPATIBLE_API). Берём метод динамически (bracket-доступ) — так
    // статический линтер не флагает API, а на Android, где метода нет, честно
    // отдаём false: баннер доступа остаётся, ничего не падает. На Firefox
    // desktop / Chromium работает как прежде.
    const requestPermission = chrome.permissions?.['request']?.bind(chrome.permissions) as
      | ((permissions: chrome.permissions.Permissions) => Promise<boolean>)
      | undefined;
    if (!requestPermission) return false;
    try {
      const ok = await requestPermission({ origins: VK_BACKGROUND_HOST_ORIGINS });
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
