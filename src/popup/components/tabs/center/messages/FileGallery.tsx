import Checkbox from '@/popup/components/ui/Checkbox.js';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { peerUrl, type GlobalToolFile } from '@/shared/center-tools.js';
import { ImageIcon, FileTextIcon, LinkIcon, VideoIcon, MicIcon, ExternalLinkIcon, MessengerIcon } from '@/popup/components/icons/Icons.js';

export const fileIcons = { photo: ImageIcon, doc: FileTextIcon, link: LinkIcon, video: VideoIcon, audio_message: MicIcon };
export function FileGallery({ files, onDialog, selected, disabled, onToggle }: { files: GlobalToolFile[]; onDialog?: (peerId: number) => void;
  selected?: string[]; disabled?: boolean; onToggle?: (key: string) => void }) {
  return <div className="ct-gallery">{files.map(file => <FileCard key={file.key} file={file} onDialog={onDialog} checked={selected?.includes(file.key)} disabled={disabled} onToggle={onToggle} />)}</div>;
}
function FileCard({ file, onDialog, checked, disabled, onToggle }: { file: GlobalToolFile; onDialog?: (peerId: number) => void;
  checked?: boolean; disabled?: boolean; onToggle?: (key: string) => void }) {
  const { t, i18n } = useTranslation('center');
  const [broken, setBroken] = useState(false);
  const Icon = fileIcons[file.type];
  const preview = <div className="ct-file-preview">{file.preview && !broken
    ? <img src={file.preview} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} /> : <Icon />}
    <span className="ct-file-kind"><Icon /></span></div>;
  return <article className="ct-file">
    {onToggle && <label className="ct-item-selection"><Checkbox checked={!!checked} disabled={disabled} onChange={() => onToggle(file.key)} />{t('bulk.select_item', { title: file.title || t('files.types.' + file.type) })}</label>}
    {file.url ? <a href={file.url} target="_blank" rel="noopener noreferrer" aria-label={file.title || t('files.types.' + file.type)}>{preview}</a> : preview}
    <div className="ct-file-body">
      <strong title={file.title}>{file.title || t('files.types.' + file.type)}</strong>
      {onDialog && <button className="ct-file-origin" onClick={() => onDialog(file.peerId)} title={file.dialogTitle}><MessengerIcon /><span>{file.dialogTitle}</span></button>}
      <small>{file.date ? new Date(file.date * 1000).toLocaleDateString(i18n.resolvedLanguage) : ''}{file.size !== null ? ` · ${(file.size / 1048576).toFixed(1)} MB` : ''}</small>
      <div className="ct-file-links">{file.url && <a href={file.url} target="_blank" rel="noopener noreferrer"><ExternalLinkIcon />{t('files.open_file')}</a>}
        {file.cmid > 0 && <a href={peerUrl(file.peerId, file.cmid)} target="_blank" rel="noopener noreferrer"><LinkIcon />{t('files.open_message')}</a>}</div>
    </div>
  </article>;
}
