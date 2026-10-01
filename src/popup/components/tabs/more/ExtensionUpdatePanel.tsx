import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardPanel } from '@/popup/components/ui/DashboardPrimitives.js';
import { DownloadIcon, RefreshIcon } from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import { FIREFOX_INSTALL_URL, type ExtensionUpdate } from '@/shared/extension-update.js';
import { openTab } from '@/popup/utils/tabs.js';

export default function ExtensionUpdatePanel(): React.ReactElement {
  const { t } = useTranslation('settings');
  const [update, setUpdate] = useState<ExtensionUpdate | null>(null);
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void sendMessage({ type: 'CHECK_EXTENSION_UPDATE' }).then(result => {
      if (!alive) return;
      if (!result?.success || !result.update) throw new Error('Check failed');
      setUpdate(result.update);
    }).catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setChecking(false); });
    return () => { alive = false; };
  }, []);

  const check = async (): Promise<void> => {
    setChecking(true);
    setFailed(false);
    try {
      const result = await sendMessage({ type: 'CHECK_EXTENSION_UPDATE', force: true });
      if (!result?.success || !result.update) throw new Error('Check failed');
      setUpdate(result.update);
    } catch { setFailed(true); }
    finally { setChecking(false); }
  };

  return <DashboardPanel title={t('more.update.title')} icon={<DownloadIcon className="h-5 w-5" />}>
    <div className="px-4 pb-4 space-y-3">
      <p role="status" aria-live="polite" className="text-sm text-[var(--text-secondary)]">
        {checking ? t('more.update.checking') : failed ? t('more.update.failed') : update?.available
          ? t('more.update.available', { version: update.latestVersion })
          : t('more.update.current', { version: update?.currentVersion })}
      </p>
      <div className="flex flex-wrap gap-2">
        {update?.available && <button type="button" className="dashboard-button dashboard-button--primary"
          onClick={() => openTab(FIREFOX_INSTALL_URL)}><DownloadIcon className="w-4 h-4" />{t('more.update.install')}</button>}
        <button type="button" disabled={checking} onClick={() => void check()} className="dashboard-button">
          <RefreshIcon className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />{t('more.update.check')}
        </button>
      </div>
    </div>
  </DashboardPanel>;
}
