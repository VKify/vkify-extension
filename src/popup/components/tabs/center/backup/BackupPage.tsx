import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import {
  DatabaseIcon, DownloadIcon, StopIcon, FeedIcon, PhotoAlbumIcon, VideoIcon,
  FileTextIcon, BookmarkIcon, HeartIcon, CommunitiesIcon, FriendsIcon, ProfileIcon,
  AttachIcon,
} from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import {
  ACCOUNT_BACKUP_STATE_KEY,
  EMPTY_ACCOUNT_BACKUP_STATE,
  type AccountBackupFormat,
  type AccountBackupSection,
  type AccountBackupState,
} from '@/shared/account-backup.js';
import BackupProgress from './BackupProgress.js';
import { subscribeStorage } from '@/popup/utils/storageClient.js';

const SECTIONS: { id: AccountBackupSection; icon: React.ReactNode }[] = [
  { id: 'wall', icon: <FeedIcon className="w-5 h-5" /> },
  { id: 'photos', icon: <PhotoAlbumIcon className="w-5 h-5" /> },
  { id: 'videos', icon: <VideoIcon className="w-5 h-5" /> },
  { id: 'docs', icon: <FileTextIcon className="w-5 h-5" /> },
  { id: 'notes', icon: <BookmarkIcon className="w-5 h-5" /> },
  { id: 'gifts', icon: <HeartIcon className="w-5 h-5" /> },
  { id: 'subscriptions', icon: <CommunitiesIcon className="w-5 h-5" /> },
  { id: 'friends', icon: <FriendsIcon className="w-5 h-5" /> },
  { id: 'profile', icon: <ProfileIcon className="w-5 h-5" /> },
];

const INITIAL_SELECTED = new Set<AccountBackupSection>(SECTIONS.map(x => x.id).filter(x => x !== 'friends'));

export default function BackupPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const [selected, setSelected] = useState(() => new Set(INITIAL_SELECTED));
  const [format, setFormat] = useState<AccountBackupFormat>('json');
  const [includeMedia, setIncludeMedia] = useState(false);
  const [state, setState] = useState<AccountBackupState>(EMPTY_ACCOUNT_BACKUP_STATE);

  const refresh = useCallback(async (): Promise<void> => {
    const response = await sendMessage({ type: 'GET_ACCOUNT_BACKUP_STATE' });
    if (response?.success) setState(response.state);
  }, []);

  useEffect(() => {
    void refresh();
    return subscribeStorage([ACCOUNT_BACKUP_STATE_KEY], changes => {
      if (changes[ACCOUNT_BACKUP_STATE_KEY]?.newValue) {
        setState(changes[ACCOUNT_BACKUP_STATE_KEY].newValue as AccountBackupState);
      }
    });
  }, [refresh]);

  const toggle = (id: AccountBackupSection, value: boolean): void => {
    setSelected(current => {
      const next = new Set(current);
      value ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const start = async (): Promise<void> => {
    const response = await sendMessage({
      type: 'START_ACCOUNT_BACKUP',
      options: { sections: SECTIONS.map(x => x.id).filter(id => selected.has(id)), format, includeMedia },
    });
    if (!response?.success) {
      setState({ ...EMPTY_ACCOUNT_BACKUP_STATE, status: 'failed', error: response?.error });
    } else {
      await refresh();
    }
  };

  const running = state.status === 'running';

  const download = async (): Promise<void> => {
    const response = await sendMessage({ type: 'DOWNLOAD_ACCOUNT_BACKUP' });
    if (!response?.success) setState(current => ({ ...current, error: response?.error }));
  };

  return (
    <div className="space-y-4" data-vkify-anchor="account_backup">
      <SettingsSection
        title={t('backup.title')}
        description={t('backup.description')}
        icon={<DatabaseIcon className="w-5 h-5" />}
        iconColor="purple"
      >
        {SECTIONS.map((section, index) => (
          <React.Fragment key={section.id}>
            {index > 0 && <SectionDivider />}
            <SettingRow
              id={`account_backup_${section.id}`}
              title={t(`backup.sections.${section.id}`)}
              icon={section.icon}
              checked={selected.has(section.id)}
              onToggle={value => toggle(section.id, value)}
              disabled={running}
            />
          </React.Fragment>
        ))}
      </SettingsSection>

      <SettingsSection title={t('backup.format_title')} description={t('backup.format_description')}>
        <div className="grid grid-cols-2 gap-2 px-4 py-4">
          {(['json', 'zip'] as const).map(value => (
            <button
              key={value}
              type="button"
              disabled={running}
              onClick={() => {
                setFormat(value);
                if (value === 'json') setIncludeMedia(false);
              }}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${format === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'}`}
            >
              <span className="block text-sm font-semibold">{value.toUpperCase()}</span>
              <span className="block text-[11px] text-[var(--text-secondary)]">{t(`backup.formats.${value}`)}</span>
            </button>
          ))}
        </div>
        <SectionDivider />
        <SettingRow
          id="account_backup_media"
          title={t('backup.media_title')}
          description={t('backup.media_description')}
          icon={<AttachIcon className="w-5 h-5" />}
          checked={includeMedia}
          onToggle={value => {
            setIncludeMedia(value);
            if (value) setFormat('zip');
          }}
          disabled={running}
        />
        {(running || state.status !== 'idle') && <BackupProgress state={state} />}
        <div className="flex gap-2 px-4 pb-4">
          {running ? (
            <button type="button" onClick={() => void sendMessage({ type: 'CANCEL_ACCOUNT_BACKUP' })} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-white">
              <StopIcon className="w-5 h-5" />{t('backup.cancel')}
            </button>
          ) : state.status === 'completed' ? (
            <button type="button" onClick={() => void download()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white">
              <DownloadIcon className="w-5 h-5" />{t('backup.download')}
            </button>
          ) : (
            <button type="button" disabled={selected.size === 0} onClick={() => void start()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">
              <DownloadIcon className="w-5 h-5" />{t('backup.start')}
            </button>
          )}
          {!running && state.status === 'completed' && (
            <button type="button" onClick={() => void start()} className="rounded-xl border border-[var(--border-color)] px-3 py-3 text-xs font-medium text-[var(--text-primary)]">
              {t('backup.restart')}
            </button>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}
