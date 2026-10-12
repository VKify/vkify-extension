import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVKifyStore } from '@/popup/store/index.js';
import { isSafeLogoResource, LOGO_IMAGE_TYPES, MAX_LOGO_FILE_SIZE } from '@/shared/custom-logo.js';
import SettingRow from '../../ui/SettingRow.js';
import NestedSettings from '../../ui/NestedSettings.js';
import { Input } from '../../ui/FormControls.js';
import UploadButton from '../../ui/UploadButton.js';
import IconButton from '../../ui/IconButton.js';
import ResetButton from '../../ui/ResetButton.js';
import { VKIcon, ImageIcon, CheckIcon } from '../../icons/Icons.js';

async function readImage(blob: Blob): Promise<string> {
  if (!LOGO_IMAGE_TYPES.includes(blob.type) || !blob.size || blob.size > MAX_LOGO_FILE_SIZE) throw new Error('Invalid file');
  const value = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  if (!isSafeLogoResource(value)) throw new Error('Invalid image');
  const image = new Image(); image.src = value; await image.decode();
  return value;
}

export default function CustomLogoSettings(): React.ReactElement {
  const { t } = useTranslation('appearance');
  const enabled = useVKifyStore(s => s.settings.custom_logo_enabled === true);
  const source = useVKifyStore(s => s.settings.custom_logo ?? '');
  const saveMultiple = useVKifyStore(s => s.saveMultiple);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { setUrl(source.startsWith('data:') ? '' : source); setError(''); }, [source]);
  useEffect(() => () => { request.current++; }, []);
  const save = async (value: string): Promise<void> => {
    const success = await saveMultiple({ custom_logo: value, custom_logo_enabled: !!value });
    if (!success) setError(t('display.logo.save_error'));
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!LOGO_IMAGE_TYPES.includes(file.type) || file.size > MAX_LOGO_FILE_SIZE) {
      setError(t('display.logo.file_error')); return;
    }
    const revision = ++request.current;
    setBusy(true); setError('');
    try {
      const value = await readImage(file);
      if (request.current === revision) await save(value);
    } catch {
      if (request.current === revision) setError(t('display.logo.load_error'));
    } finally {
      if (request.current === revision) setBusy(false);
    }
  };
  const applyUrl = async (): Promise<void> => {
    const value = url.trim();
    if (!value || !/^https?:\/\//i.test(value) || !isSafeLogoResource(value)) { setError(t('display.logo.url_error')); return; }
    const revision = ++request.current;
    setBusy(true); setError('');
    try {
      // Persist bytes so VK's image CSP cannot block a third-party logo.
      const response = await fetch(value, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Image request failed');
      const resource = await readImage(await response.blob());
      if (request.current === revision) await save(resource);
    } catch {
      if (request.current === revision) setError(t('display.logo.url_load_error'));
    } finally {
      if (request.current === revision) setBusy(false);
    }
  };
  return <>
    <SettingRow id="custom_logo_enabled" title={t('display.logo.title')} description={t('display.logo.desc')}
      icon={<VKIcon className="w-5 h-5" />} disabled={busy} showDocs={false} />
    <NestedSettings open={enabled}>
      <div className="space-y-3 px-4 py-3">
        <form className="flex items-end gap-2" onSubmit={event => {
          event.preventDefault(); void applyUrl();
        }}>
          <label className="min-w-0 flex-1 space-y-1 text-xs text-[var(--text-secondary)]">
            <span>{t('display.logo.url')}</span>
            <Input type="url" icon={<ImageIcon />} value={url} disabled={busy}
              aria-invalid={!!error} onChange={event => { setUrl(event.target.value); setError(''); }}
              placeholder="https://example.com/logo.png"
              className="w-full" />
          </label>
          <IconButton title={t('display.logo.apply')} disabled={busy || !url.trim()} onClick={() => { void applyUrl(); }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary hover:bg-primary-hover">
            <CheckIcon className="w-5 h-5 text-white" />
          </IconButton>
        </form>
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-[var(--border-color)]" />
          <span className="text-xs text-[var(--text-tertiary)]">{t('background.or')}</span>
          <div className="flex-1 border-t border-[var(--border-color)]" />
        </div>
        <UploadButton label={t('display.logo.upload')} loadingLabel={t('background.uploading')}
          loading={busy} onClick={() => fileInput.current?.click()} />
        <input ref={fileInput} type="file" accept={LOGO_IMAGE_TYPES.join(',')} disabled={busy}
          aria-label={t('display.logo.upload')} onChange={event => { void upload(event); }} className="hidden" />
        <p className="text-xs text-[var(--text-tertiary)]">{t('display.logo.hint')}</p>
        {source && isSafeLogoResource(source) && <div className="flex min-h-12 items-center rounded-xl border-2 border-primary/30 bg-[var(--bg-secondary)] p-3">
          <img key={source} src={source} alt={t('display.logo.preview')} referrerPolicy="no-referrer"
            className="h-6 w-[136px] object-contain object-left" onError={() => setError(t('display.logo.load_error'))} />
        </div>}
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        <fieldset disabled={busy} className="disabled:opacity-50">
          <ResetButton label={t('display.logo.reset')} onClick={() => { setError(''); void save(''); }} />
        </fieldset>
      </div>
    </NestedSettings>
  </>;
}
