import InfoDisclosure from '@/popup/components/ui/InfoDisclosure.js';
import Checkbox from '@/popup/components/ui/Checkbox.js';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import { DashboardPanel, DashboardSettingCard } from '@/popup/components/ui/DashboardPrimitives.js';
import { useStorageReload } from '@/popup/hooks/core/useStorageReload.js';
import { getStorage } from '@/popup/utils/storageClient.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { PlayIcon, StopIcon, UserPlusIcon, UsersIcon, WarningIcon, ZapIcon } from '@/popup/components/icons/Icons.js';
import { sendMessage } from '@/shared/messaging.js';
import { AUTO_ADD_STATE, AUTO_ADD_DEFAULTS, AUTO_ADD_CAPS, type AutoAddSource, type AutoAddState, type AutoAddOptions } from '@/shared/auto-add-friends.js';
import { GROUP_PARSER_STATE, type GroupParserState } from '@/shared/group-parser.js';
import { parseUserList, USER_LIST_FILE_MAX } from '@/shared/user-lists.js';
import '../CenterTools.css';
const AUTO_ADD_KEYS = [AUTO_ADD_STATE, GROUP_PARSER_STATE, 'vk_user_id'];

export default function AutoAddFriendsPage(): React.ReactElement {
  const { t } = useTranslation('automation');
  const [options, setOptions] = useState<AutoAddOptions>(AUTO_ADD_DEFAULTS);
  const [acknowledged, setAcknowledged] = useState(false);
  const [sourceKind, setSourceKind] = useState('recommendations');
  const [listText, setListText] = useState(''), [fileError, setFileError] = useState('');
  const [fileName, setFileName] = useState('');
  const [parser, setParser] = useState<GroupParserState | null>(null);
  const [ownerId, setOwnerId] = useState(''), [importing, setImporting] = useState(false);
  const fileVersion = useRef(0);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const optionsLoaded = useRef(false);
  const setOption = (key: keyof AutoAddOptions, value: number): void => {
    setOptions(current => ({ ...current, [key]: value }));
  };
  const { showToast } = useToast();
  const [stats, setStats] = useState<AutoAddState>({ added: 0, attempted: 0, isRunning: false });

  const reloadStats = useCallback(async (): Promise<void> => {
    try {
      const result = await getStorage(AUTO_ADD_KEYS);
      setParser((result[GROUP_PARSER_STATE] as GroupParserState | undefined) ?? null);
      setOwnerId(String(result.vk_user_id ?? ''));
      const state = result[AUTO_ADD_STATE] as AutoAddState | undefined;
      if (state) {
        setStats({ ...state, attempted: state.attempted ?? 0 });
        if (!optionsLoaded.current) {
          if (state.options) setOptions(state.options);
          if (state.source?.kind === 'list') {
            setSourceKind('list'); setListText(state.source.ids.join('\n'));
          }
        }
      }
      if (state?.isRunning && state.options) setOptions(state.options);
      optionsLoaded.current = true;
    } catch { /* storage can be unavailable in the preview */ }
    finally { setLoading(false); }
  }, []);
  useStorageReload(AUTO_ADD_KEYS, reloadStats);

  const enabled = stats.isRunning;
  const parsed = useMemo(() => {
    if (!listText.trim()) return { ids: [] as number[], error: '' };
    try { return { ids: parseUserList(listText), error: '' }; }
    catch (error) { return { ids: [] as number[], error: (error as Error).message }; }
  }, [listText]);
  const communityReady = !!parser?.ids.length && parser.status !== 'running' && parser.userId === ownerId;
  const source: AutoAddSource = sourceKind === 'recommendations' ? { kind: 'recommendations' }
    : sourceKind === 'community' ? { kind: 'list', ids: communityReady ? parser!.ids : [], name: parser?.group?.name, ownerId: parser?.userId }
    : { kind: 'list', ids: parsed.ids, name: fileName || undefined };
  const sourceReady = source.kind === 'recommendations' || source.ids.length > 0;
  const upload = async (file?: File) => {
    if (!file) return;
    const version = ++fileVersion.current;
    setFileError(''); setImporting(true);
    try {
      if (file.size > USER_LIST_FILE_MAX) throw new Error('USER_LIST_TOO_LARGE');
      const text = await file.text();
      parseUserList(text);
      if (version === fileVersion.current) { setListText(text); setFileName(file.name); }
    } catch (error) { if (version === fileVersion.current) { setFileError((error as Error).message); setListText(''); setFileName(''); } }
    finally { if (version === fileVersion.current) setImporting(false); }
  };
  const toggle = async (): Promise<void> => {
    setPending(true);
    try {
      const response = await sendMessage(enabled ? { type: 'STOP_AUTO_ADD_FRIENDS' }
        : { type: 'START_AUTO_ADD_FRIENDS', options, acknowledged, source });
      if (!response?.success) throw new Error(response?.error ?? t('autoadd.command_failed'));
      await reloadStats();
      showToast(t(enabled ? 'autoadd.toast_off' : 'autoadd.toast_on'), 'success');
      if (!enabled) setAcknowledged(false);
    } catch (error) {
      showToast((error as Error).message, 'error');
      await reloadStats();
    } finally { setPending(false); }
  };

  return <div className="space-y-3 pb-4">
    <DashboardPanel title={t('autoadd.status_title')}
      icon={<UsersIcon className="h-5 w-5" />} className="pb-4">
      <div className="px-4 pt-1" data-vkify-anchor="auto_add_friends">
        <DashboardSettingCard icon={enabled ? <StopIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
          title={enabled ? t('autoadd.script_on') : t('autoadd.script_off')}
          description={t('autoadd.added_session', { count: stats.added })}
          control={<button type="button" onClick={() => { void toggle(); }} disabled={loading || pending || importing || (!enabled && (!acknowledged || !sourceReady || options.delayMax < options.delayMin))}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${enabled ? 'bg-error/10 text-error hover:bg-error/15' : 'bg-success/10 text-success hover:bg-success/15'}`}>
            {enabled ? t('autoadd.stop') : t('autoadd.start')}
          </button>} />
        <p className="mt-3 text-xs text-[var(--text-secondary)]" role="status">
          {t('autoadd.usage', { attempts: stats.attempted, hour: stats.hourUsed ?? 0, day: stats.dayUsed ?? 0 })}
          {enabled && stats.nextAt ? ' · ' + t('autoadd.next_at', { time: new Date(stats.nextAt).toLocaleTimeString() }) : ''}
        </p>
        {stats.reason && <p role={stats.reason === 'error' || stats.reason === 'interrupted' ? 'alert' : 'status'} className="mt-2 text-sm text-warning">
          {stats.code ? t('autoadd.errors.' + stats.code, { defaultValue: stats.error ?? t('autoadd.error_code', { code: stats.code }) }) : t('autoadd.reasons.' + stats.reason)}
          {!stats.code && stats.error ? ': ' + stats.error : ''}
        </p>}
      </div>
    </DashboardPanel>

    <fieldset disabled={enabled || pending || importing} className="space-y-3 disabled:opacity-55">
      <section className="center-tool ct-panel space-y-3">
        <div className="ct-toolbar">
          <label className="text-sm">{t('autoadd.source')}
            <select aria-label={t('autoadd.source')} value={sourceKind} onChange={e => { fileVersion.current++; setSourceKind(e.target.value); setImporting(false); }}>
              <option value="recommendations">{t('autoadd.sources.recommendations')}</option>
              <option value="list">{t('autoadd.sources.list')}</option>
              <option value="community" disabled={!communityReady}>{t('autoadd.sources.community')}</option>
            </select>
          </label>
          {source.kind === 'list' && <span className="ct-note">{t('autoadd.list_count', { count: source.ids.length })}</span>}
        </div>
        {sourceKind === 'list' && <>
          <textarea aria-label={t('autoadd.list_input')} placeholder={t('autoadd.list_placeholder')} rows={3} maxLength={USER_LIST_FILE_MAX} value={listText}
            className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3 text-sm"
            onChange={e => { fileVersion.current++; setListText(e.target.value); setFileError(''); setFileName(''); }} />
          <div className="ct-toolbar">
            <label className="ct-button cursor-pointer focus-within:ring-2 focus-within:ring-primary/30">
              {t('autoadd.upload_short')}
              <input className="sr-only" type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json" aria-label={t('autoadd.upload')} onChange={e => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <span className="ct-note truncate" title={fileName}>{fileName || 'TXT · CSV · JSON'}</span>
          </div>
          {(fileError || parsed.error) && <p role="alert" className="text-sm text-error">{t('autoadd.errors.' + (fileError || parsed.error), { defaultValue: t('autoadd.errors.INVALID_USER_LIST') })}</p>}
        </>}
        {sourceKind === 'community' && <p className="ct-note">{parser?.group?.name} · {t('autoadd.parser_source')}</p>}
      </section>
      <DashboardPanel title={t('autoadd.params')}
        icon={<ZapIcon className="h-5 w-5" />} className="pb-4">
        <div className="grid grid-cols-2 gap-3 px-4 pt-1 max-[650px]:grid-cols-1">
          <DashboardSettingCard icon={<UserPlusIcon className="h-5 w-5" />} className="items-start">
            <RangeSlider id="auto_add_limit" label={t('autoadd.limit')}
              value={options.hour} min={1} max={AUTO_ADD_CAPS.hour} step={1}
              unit={t('autoadd.unit_requests')} onChange={value => setOption('hour', value)} />
          </DashboardSettingCard>
          <DashboardSettingCard icon={<PlayIcon className="h-5 w-5" />} className="items-start">
            <RangeSlider id="auto_add_delay_min" label={t('autoadd.delay_min')}
              value={options.delayMin} min={AUTO_ADD_CAPS.delayMin} max={AUTO_ADD_CAPS.delayMax} step={5}
              unit={t('autoadd.unit_sec')} onChange={value => setOption('delayMin', value)} />
          </DashboardSettingCard>
          <DashboardSettingCard icon={<StopIcon className="h-5 w-5" />} className="items-start">
            <RangeSlider id="auto_add_delay_max" label={t('autoadd.delay_max')}
              value={options.delayMax} min={AUTO_ADD_CAPS.delayMin} max={AUTO_ADD_CAPS.delayMax} step={5}
              unit={t('autoadd.unit_sec')} onChange={value => setOption('delayMax', value)} />
          </DashboardSettingCard>
          {(['day', 'session'] as const).map(key => <DashboardSettingCard key={key} icon={<UserPlusIcon className="h-5 w-5" />} className="items-start">
            <RangeSlider id={'auto_add_' + key} label={t('autoadd.limit_' + key)} value={options[key]}
              min={1} max={AUTO_ADD_CAPS[key]} step={1} unit={t('autoadd.unit_requests')}
              onChange={value => setOption(key, value)} />
          </DashboardSettingCard>)}
        </div>
        {options.delayMax < options.delayMin && <p className="px-4 pt-2 text-sm text-error" role="alert">{t('autoadd.invalid_delay')}</p>}
      </DashboardPanel>
    </fieldset>

    <p className="flex items-start gap-2 text-xs text-warning"><WarningIcon className="h-4 w-4 shrink-0" />{t('autoadd.warn_body')}</p>
    {!enabled && <label className="flex items-start gap-2 text-sm">
      <Checkbox checked={acknowledged} disabled={pending} onChange={event => setAcknowledged(event.target.checked)} />
      {t('autoadd.acknowledge')}
    </label>}
    <InfoDisclosure title={t('autoadd.details')}><p>{t('autoadd.local_limits')}</p><p>{t('autoadd.parser_hint')}</p></InfoDisclosure>
  </div>;
}
