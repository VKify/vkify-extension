import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendMessage } from '@/shared/messaging.js';
import type { SettingsDocumentList } from '@/shared/settings-document.js';
import { TokenStatus } from '@/types/index.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { DownloadIcon, RefreshIcon } from '../../icons/Icons.js';

export default function SettingsDocumentRestore({ disabled, onBusyChange }: {
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t, i18n } = useTranslation('settings');
  const { showToast } = useToast();
  const [list, setList] = useState<SettingsDocumentList | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState<'list' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);

  const showError = (code?: string, reason?: string) => {
    const key = code === 'ACCOUNT_CHANGED' ? 'vk_account_changed'
      : code === TokenStatus.NO_TOKEN || code === TokenStatus.NO_VK_TAB || code === TokenStatus.EXPIRED || code === 'TOKEN_EXPIRED'
        ? 'vk_auth_required' : code === '15' || code === '7' ? 'vk_access_denied'
        : code === 'VK_DOCUMENT_NOT_FOUND' ? 'vk_document_missing'
        : code === 'VK_DOCUMENT_FORMAT' ? 'vk_document_invalid'
        : code === 'VK_DOCUMENT_DOWNLOAD' ? 'vk_document_download_failed'
        : code === 'VK_DOCUMENT_URL' ? 'vk_document_url_failed' : 'vk_restore_failed';
    const detail = reason?.replace(/https?:\/\/\S+/g, '[URL]').slice(0, 240);
    setError(`${t(`more.data.toast.${key}`)}${detail && !['vk_account_changed', 'vk_auth_required', 'vk_access_denied', 'vk_document_missing', 'vk_document_invalid'].includes(key) ? ` (${detail})` : ''}`);
    if (code === 'ACCOUNT_CHANGED') { setList(null); setSelected(null); }
  };

  const load = async () => {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy('list'); onBusyChange(true); setError(null);
    setList(null); setSelected(null);
    try {
      const result = await sendMessage({ type: 'LIST_SETTINGS_DOCUMENTS' });
      if (!result?.success || !result.documents || !result.userId) { showError(result?.code, result?.error); return; }
      setList({ documents: result.documents, userId: result.userId });
      setSelected(result.documents[0]?.id ?? null);
    } catch (error) { showError(undefined, (error as Error).message); }
    finally { pending.current = false; setBusy(null); onBusyChange(false); }
  };

  const apply = async () => {
    if (pending.current || disabled || !list || selected === null) return;
    pending.current = true;
    setBusy('apply'); onBusyChange(true); setError(null);
    try {
      const result = await sendMessage({ type: 'READ_SETTINGS_DOCUMENT', userId: list.userId, documentId: selected });
      if (!result?.success || !result.json) { showError(result?.code, result?.error); return; }
      const identity = await sendMessage({ type: 'VK_API_CALL', method: 'users.get', params: {}, expectedUserId: list.userId });
      if (!identity?.success) { showError(identity?.code, identity?.error); return; }
      const success = await useVKifyStore.getState().importSettings(new File([result.json], 'vkify-settings.json', { type: 'application/json' }));
      if (!success) { setError(t('more.data.toast.invalid_file')); return; }
      showToast(t('more.data.toast.vk_restored'), 'success');
    } catch (error) { showError(undefined, (error as Error).message); }
    finally { pending.current = false; setBusy(null); onBusyChange(false); }
  };

  const date = (timestamp: number) => timestamp > 0
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
    : t('more.data.vk_date_unknown');

  return <div className="more-data-restore" data-vkify-anchor="restore_settings_vk" aria-busy={busy !== null}>
    <button className="more-data-vk__link" onClick={load} disabled={disabled || busy !== null}>
      {list ? <RefreshIcon className="w-4 h-4" /> : <DownloadIcon className="w-4 h-4" />}
      {t(busy === 'list' ? 'more.data.vk_loading' : list ? 'more.data.vk_refresh' : 'more.data.vk_restore_title')}
    </button>
    {error && <p className="more-data-restore__error" role="alert">{error}</p>}
    {list && (list.documents.length === 0
      ? <p className="more-data-restore__hint" role="status">{t('more.data.vk_no_documents')}</p>
      : <>
        <div className="more-data-restore__files" role="radiogroup" aria-label={t('more.data.vk_choose_file')}>
          {list.documents.map((doc, index) => <label className="more-data-restore__file" key={doc.id}>
            <input type="radio" name="vk-settings-document" value={doc.id} checked={selected === doc.id}
              disabled={disabled || busy !== null} onChange={() => setSelected(doc.id)} />
            <span className="more-data-restore__copy">
              <strong>{date(doc.savedAt)}{index === 0 && <span className="more-data-restore__latest">{t('more.data.vk_latest')}</span>}</strong>
              <span title={doc.title}>{doc.title}</span>
            </span>
          </label>)}
        </div>
        <p className="more-data-restore__hint">{t('more.data.vk_apply_hint')}</p>
        <button className="dashboard-button dashboard-button--primary" disabled={disabled || busy !== null || selected === null} onClick={apply}>
          <DownloadIcon className="w-4 h-4" />{t(busy === 'apply' ? 'more.data.vk_applying' : 'more.data.vk_apply')}
        </button>
      </>)}
  </div>;
}
