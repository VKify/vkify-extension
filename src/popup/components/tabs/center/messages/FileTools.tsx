import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GlobalToolFile } from '@/shared/center-tools.js';
import { downloadText } from '@/shared/utils/download.js';
import BulkActions from '../BulkActions.js';
import { FileGallery } from './FileGallery.js';

/** Selection spans pages; actions always use explicitly selected attachments. */
export default function FileTools({ files, visible = files, ownerId, scope, disabled, onDialog }: {
  files: GlobalToolFile[]; visible?: GlobalToolFile[]; ownerId: string | null;
  scope: string; disabled?: boolean; onDialog?: (peer: number) => void;
}) {
  const { t } = useTranslation('center');
  const [selected, setSelected] = useState<string[]>([]), [busy, setBusy] = useState(false);
  useEffect(() => { setSelected([]); }, [ownerId, scope]);
  const chosen = files.filter(file => selected.includes(file.key));
  const downloads = chosen.filter(file => ['photo', 'doc', 'audio_message'].includes(file.type) && file.url?.startsWith('https://'));
  const filename = (file: GlobalToolFile) => {
    const extension = new URL(file.url!).pathname.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1]
      ?? (file.type === 'photo' ? 'jpg' : file.type === 'audio_message' ? 'mp3' : 'bin');
    return `vkify-${file.peerId}-${file.cmid}-${selected.indexOf(file.key) + 1}.${extension}`;
  };
  return <>
    <div className="ct-toolbar mt-3"><button className="ct-button" disabled={busy || !files.length} onClick={() => setSelected(files.map(file => file.key))}>{t('bulk.select_filtered', { count: files.length })}</button>
      <button className="ct-button" disabled={busy || !selected.length} onClick={() => setSelected([])}>{t('bulk.clear')}</button>
      <button className="ct-button" disabled={!files.length} onClick={() => downloadText(JSON.stringify(chosen.length ? chosen : files, null, 2), 'vkify-attachments.json', 'application/json')}>{t('bulk.export_list')}</button>
      <span className="ct-note">{t('bulk.selected', { count: chosen.length })}</span></div>
    <BulkActions ownerId={ownerId} scope={scope} disabled={disabled} onBusyChange={setBusy} actions={[
      { key: 'download_files', jobs: downloads.map(file => ({ id: file.key, title: file.title || t('files.types.' + file.type), method: 'download.attachment', params: { url: file.url, filename: filename(file) } })) },
      { key: 'bookmark_links', jobs: [...new Map(chosen.filter(file => file.url?.startsWith('https://')).map(file => [file.url, file])).values()].map(file => ({ id: file.key, title: file.title || file.url!, method: 'fave.addLink', params: { link: file.url } })) },
    ]} onSuccess={job => setSelected(old => old.filter(id => id !== job.id))} />
    <p className="ct-note">{t('bulk.download_note')}</p>
    <FileGallery files={visible} onDialog={onDialog} selected={selected} disabled={busy} onToggle={key => setSelected(old => old.includes(key) ? old.filter(id => id !== key) : [...old, key])} />
  </>;
}
