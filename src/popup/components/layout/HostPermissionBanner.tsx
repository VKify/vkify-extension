import React, { useState } from 'react';
import { useHostPermission } from '../../hooks/features/useHostPermission.js';

/**
 * Онбординг доступа к VK для Firefox. В Firefox MV3 host_permissions опциональны;
 * без них фоновые запросы к api.vk.com (спай, метод API, профили) молча не
 * работают. Баннер появляется только на Firefox и только пока доступ не выдан.
 */
export default function HostPermissionBanner(): React.ReactElement | null {
  const { needsGrant, request } = useHostPermission();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!needsGrant) return null;

  const onClick = async (): Promise<void> => {
    setBusy(true);
    setFailed(false);
    const ok = await request();
    setBusy(false);
    if (!ok) setFailed(true);
  };

  return (
    <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
      <div className="flex items-start gap-3">
        <span className="text-base flex-shrink-0">🔓</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Нужен доступ к VK</p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-0.5">
            Firefox требует явно разрешить расширению доступ к vk.com — без этого фоновые
            функции (слежка, метод API, профили) не работают.
          </p>
          {failed && (
            <p className="text-xs text-error mt-1">
              Не удалось запросить из этого окна. Разрешите доступ через значок расширения
              в тулбаре или в about:addons → Разрешения.
            </p>
          )}
          <button
            onClick={() => void onClick()}
            disabled={busy}
            className="mt-2 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50"
          >
            {busy ? 'Запрос…' : 'Разрешить доступ'}
          </button>
        </div>
      </div>
    </div>
  );
}
