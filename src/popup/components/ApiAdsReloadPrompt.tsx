import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '../store/index.js';
import { reloadActiveVKTab } from '../utils/tabs.js';
import Modal from './ui/Modal.js';
import { RefreshIcon } from './icons/Icons.js';

/** Covers the individual toggle, core-protection action and header shortcut. */
export default function ApiAdsReloadPrompt(): React.ReactElement | null {
  const { t } = useTranslation('ads');
  const enabled = useVKifyStore(s => s.settings.block_feed_ads_api === true);
  const loading = useVKifyStore(s => s.loading);
  const previous = useRef<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (loading) { previous.current = null; return; }
    if (previous.current !== null && previous.current !== enabled) {
      setOpen(true);
      setFailed(false);
    }
    previous.current = enabled;
  }, [enabled, loading]);

  const close = () => { if (!busy) setOpen(false); };
  const reload = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const reloaded = await reloadActiveVKTab();
    setBusy(false);
    if (reloaded) setOpen(false);
    else setFailed(true);
  };

  if (!open) return null;
  return (
    <Modal title={t('reload.title')} ariaLabel={t('reload.title')} onClose={close} footer={
      <>
        <button type="button" onClick={close} disabled={busy}
          className="flex-1 px-3 py-2 text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-tertiary)] disabled:opacity-50">
          {t('reload.later')}
        </button>
        <button type="button" onClick={() => void reload()} disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-hover disabled:opacity-50">
          <RefreshIcon className={`w-4 h-4 shrink-0 ${busy ? 'animate-spin' : ''}`} />
          {t(busy ? 'reload.busy' : 'reload.confirm')}
        </button>
      </>
    }>
      <div className="p-4 space-y-3">
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">
          {t(enabled ? 'reload.enabled' : 'reload.disabled')}
        </p>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('reload.hint')}</p>
        {failed && <p role="alert" className="text-sm text-error">{t('reload.failed')}</p>}
      </div>
    </Modal>
  );
}
