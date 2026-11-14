import { Select } from '../../ui/FormControls.js';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Toggle from '../../ui/Toggle.js';
import Modal from '../../ui/Modal.js';
import { CopyIcon, LinkIcon, RefreshIcon } from '../../icons/Icons.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { copyText } from '@/popup/utils/clipboard.js';
import { shortenThemeLink } from '@/popup/utils/themeShortLink.js';

interface Props { url: string; localBackground: boolean; onClose(): void }

/** Shortening and copying are separate gestures: no clipboard permission is needed. */
export default function ThemeShareDialog({ url, localBackground, onClose }: Props): React.ReactElement {
  const { t } = useTranslation('appearance');
  const { showToast } = useToast();
  const [destination, setDestination] = useState<'vkify' | 'vk'>('vkify');
  const encoded = url.slice(url.lastIndexOf('/') + 1);
  const shareUrl = destination === 'vk' ? 'https://vk.ru/vkify?vkify_theme=' + encoded : url;
  const [shorten, setShorten] = useState(true);
  const [response, setResponse] = useState<{ key: string; result?: string; failed?: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const copyBusy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  const requestKey = JSON.stringify([shareUrl, shorten, attempt]);
  useEffect(() => {
    if (!shorten) return;
    let current = true;
    void shortenThemeLink(shareUrl).then(
      result => { if (current) setResponse({ key: requestKey, result }); },
      () => { if (current) setResponse({ key: requestKey, failed: true }); },
    );
    return () => { current = false; };
  }, [shareUrl, shorten, requestKey]);
  const result = shorten && response?.key === requestKey ? response.result : undefined;
  const failed = shorten && response?.key === requestKey && response.failed;
  const loading = shorten && !result && !failed;
  const copy = async (): Promise<void> => {
    if (loading || copyBusy.current) return;
    copyBusy.current = true;
    try {
      await copyText(result ?? shareUrl);
      if (!alive.current) return;
      showToast(t(localBackground ? 'share.toast_copied_without_background' : 'share.toast_copied'), 'success');
      onClose();
    } catch {
      if (alive.current) showToast(t('share.toast_failed'), 'error');
    } finally { copyBusy.current = false; }
  };
  return <Modal title={t('share.section')} ariaLabel={t('share.section')} onClose={onClose} footer={
    <button type="button" onClick={() => void copy()} disabled={loading}
      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50">
      <CopyIcon className="h-4 w-4" />
      {t(loading ? 'share.shortening' : failed ? 'share.copy_original' : 'share.copy_link')}
    </button>
  }>
    <div className="p-4 space-y-3" aria-busy={loading}>
      <label className="block space-y-2 text-sm">
        <span>{t('share.destination')}</span>
        <Select icon={<LinkIcon />} aria-label={t('share.destination')} value={destination} onChange={event => setDestination(event.target.value as 'vkify' | 'vk')}
          className="w-full">
          <option value="vkify">{t('share.destination_vkify')}</option>
          <option value="vk">{t('share.destination_vk')}</option>
        </Select>
      </label>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-secondary)] px-3 py-2.5 text-sm">
        <span>{t('share.shorten_link')}</span>
        <Toggle checked={shorten} onChange={value => { setResponse(null); setShorten(value); }} ariaLabel={t('share.shorten_link')} />
      </div>
      {loading ? <div role="status" className="flex items-center gap-3 rounded-xl bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
        <RefreshIcon className="h-4 w-4 animate-spin shrink-0 text-primary" />{t('share.shortening')}
      </div> : <>
        <label className="block space-y-2">
          <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]"><LinkIcon className="h-4 w-4 text-primary" />{t(result ? 'share.short_link' : 'share.original_link')}</span>
          <input aria-label={t('share.link_label')} readOnly value={result ?? shareUrl} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()}
            className="w-full min-w-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-3 text-sm font-mono text-[var(--text-primary)] outline-none focus:border-primary" />
        </label>
        {failed && <div className="space-y-2">
          <p role="alert" className="text-xs leading-relaxed text-[var(--text-secondary)]">{t('share.shorten_failed')}</p>
          <button type="button" onClick={() => { setAttempt(value => value + 1); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
            <RefreshIcon className="h-3.5 w-3.5" />{t('share.retry')}
          </button>
        </div>}
      </>}
      {localBackground && <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{t('share.local_background')}</p>}
    </div>
  </Modal>;
}
