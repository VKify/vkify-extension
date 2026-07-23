import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHostPermission } from '../../hooks/features/useHostPermission.js';

/**
 * Онбординг доступа к VK для Firefox. В Firefox MV3 host_permissions опциональны;
 * без них фоновые запросы к api.vk.ru (спай, метод API, профили) молча не
 * работают. Баннер появляется только на Firefox и только пока доступ не выдан.
 */
export default function HostPermissionBanner(): React.ReactElement | null {
  const { t } = useTranslation('common');
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
          <p className="text-sm font-semibold text-[var(--text-primary)]">{t('host_permission.title')}</p>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-0.5">
            {t('host_permission.desc')}
          </p>
          {failed && (
            <p className="text-xs text-error mt-1">
              {t('host_permission.failed')}
            </p>
          )}
          <button
            onClick={() => void onClick()}
            disabled={busy}
            className="mt-2 px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50"
          >
            {busy ? t('host_permission.requesting') : t('host_permission.allow')}
          </button>
        </div>
      </div>
    </div>
  );
}
