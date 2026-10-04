import { Input, Select } from '@/popup/components/ui/FormControls.js';
import InfoDisclosure from '@/popup/components/ui/InfoDisclosure.js';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStorage } from '@/popup/utils/storageClient.js';
import { useStorageReload } from '@/popup/hooks/core/useStorageReload.js';
import { sendMessage } from '@/shared/messaging.js';
import { GROUP_PARSER_STATE, GROUP_PARSER_CAPS, type GroupParserState, type ParserGroup } from '@/shared/group-parser.js';
import { downloadText } from '@/shared/utils/download.js';
import { CommunitiesIcon, DownloadIcon, PlayIcon, StopIcon } from '@/popup/components/icons/Icons.js';
import RangeSlider from '@/popup/components/ui/RangeSlider.js';
import CommunityPicker from './CommunityPicker.js';
import '../CenterTools.css';
import './group-parser.css';

const KEYS = [GROUP_PARSER_STATE, 'vk_user_id'];
export default function GroupParserPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const tr = (key: string, params?: Record<string, unknown>) => t('parser.' + key, params);
  const [state, setState] = useState<GroupParserState>({ status: 'idle', ids: [] });
  const [mode, setMode] = useState('own'), [reference, setReference] = useState(''), [groupId, setGroupId] = useState('');
  const [groups, setGroups] = useState<ParserGroup[]>([]), [totalGroups, setTotalGroups] = useState(0), [groupOffset, setGroupOffset] = useState(0);
  const [limit, setLimit] = useState(1000), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [loading, setLoading] = useState(true), [ownerId, setOwnerId] = useState('');
  const loaded = useRef(false);
  const revision = useRef(0);
  const [now, setNow] = useState(Date.now());
  const groupOwner = useRef('');
  const reload = useCallback(async () => {
    const request = ++revision.current;
    try {
      const data = await getStorage([GROUP_PARSER_STATE, 'vk_user_id']);
      if (request !== revision.current) return;
      const next = data[GROUP_PARSER_STATE] as GroupParserState | undefined;
      setOwnerId(String(data.vk_user_id ?? ''));
      if (groupOwner.current && groupOwner.current !== String(data.vk_user_id ?? '')) {
        setGroups([]); setGroupId(''); setGroupOffset(0); setTotalGroups(0);
      }
      if (next) {
        setState(next);
        if ((!loaded.current || next.status === 'running') && next.limit) setLimit(next.limit);
      }
      loaded.current = true;
    } catch { setError('LOAD_FAILED'); }
    finally { setLoading(false); }
  }, []);
  useStorageReload(KEYS, reload);
  const running = state.status === 'running', locked = running || pending || loading;
  useEffect(() => {
    if (!running && !pending) return;
    const timer = window.setInterval(() => { setNow(Date.now()); void reload(); }, 1000);
    return () => window.clearInterval(timer);
  }, [running, pending, reload]);
  const ownResult = !state.userId || state.userId === ownerId;
  const loadGroups = async (more = false) => {
    setPending(true); setError('');
    try {
      const offset = more ? groupOffset : 0;
      const response = await sendMessage({ type: 'LIST_PARSER_GROUPS', offset });
      if (!response?.success || !response.groups || !response.userId) throw new Error(response?.code ?? response?.error ?? 'LOAD_FAILED');
      if (more && response.userId !== ownerId) throw new Error('ACCOUNT_CHANGED');
      setOwnerId(response.userId);
      groupOwner.current = response.userId;
      setGroups(old => more ? [...new Map([...old, ...response.groups!].map(g => [g.id, g])).values()] : response.groups!);
      setTotalGroups(response.total ?? 0); setGroupOffset(offset + 1000);
      if (!more) setGroupId(String(response.groups[0]?.id ?? ''));
    } catch (e) { setError((e as Error).message); }
    finally { setPending(false); }
  };
  const command = async () => {
    setPending(true); setError('');
    try {
      const response = await sendMessage(running ? { type: 'STOP_GROUP_PARSER' }
        : { type: 'START_GROUP_PARSER', reference: mode === 'own' ? groupId : reference, limit, expectedUserId: mode === 'own' ? groupOwner.current : undefined });
      if (!response?.success) throw new Error(response?.code ?? response?.error ?? 'LOAD_FAILED');
      await reload();
    } catch (e) { setError((e as Error).message); await reload(); }
    finally { setPending(false); }
  };
  const exportIds = (format: 'txt' | 'csv' | 'json') => {
    const content = format === 'json' ? JSON.stringify({ group: state.group, ids: state.ids }, null, 2)
      : format === 'csv' ? ['id', ...state.ids].join('\r\n') : state.ids.join('\n');
    downloadText(content, `vkify-members-${state.group?.id ?? 'list'}.${format}`, format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain');
  };
  const shownError = error || state.code;
  return <div className="center-tool group-parser" data-vkify-anchor="group-members-parser">
    <section className="ct-panel">
      <div className="ct-heading"><div className="ct-heading-identity"><span className="ct-icon-tile"><CommunitiesIcon /></span><div><span className="ct-eyebrow">{t('tools.api_label')}</span><h3>{tr('title')}</h3><p>{tr('description')}</p></div></div>
        <button className="ct-button ct-button--primary" disabled={pending || loading || !running && !(mode === 'own' ? groupId : reference.trim())} onClick={() => void command()}>
          {running ? <StopIcon /> : <PlayIcon />}{tr(running ? 'stop' : 'start')}
        </button>
      </div>
      <fieldset disabled={locked} className="parser-settings space-y-3">
        <div className="ct-toolbar">
          <Select icon={<CommunitiesIcon />} aria-label={tr('source')} value={mode} onChange={e => setMode(e.target.value)}>
            <option value="own">{tr('own')}</option><option value="link">{tr('link')}</option>
          </Select>
          {mode === 'own' ? <>
            <button className="ct-button" onClick={() => void loadGroups()}>{tr('load_groups')}</button>
            {groups.length > 0 && <CommunityPicker groups={groups} value={groupId} onChange={setGroupId} label={tr('community')} searchLabel={tr('search_groups')} emptyLabel={tr('no_groups')} disabled={locked} />}
            {groupOffset < totalGroups && <button className="ct-button" onClick={() => void loadGroups(true)}>{tr('more_groups')}</button>}
          </> : <Input className="flex-1" aria-label={tr('community')} placeholder="https://vk.ru/club123" value={reference} maxLength={250} onChange={e => setReference(e.target.value)} />}
        </div>
        <RangeSlider id="group_parser_limit" label={tr('limit')} min={1} max={GROUP_PARSER_CAPS.users} step={1} value={limit} onChange={setLimit} />
      </fieldset>
      <div role="status" aria-live="polite" className="parser-progress" aria-busy={running}>
        <div className="parser-progress__heading"><span className="parser-status" data-running={running}>{tr('status.' + state.status)}</span>
          <strong>{state.ids.length.toLocaleString()}<small> / {Math.min(state.total ?? state.limit ?? limit, state.limit ?? limit).toLocaleString()}</small></strong></div>
        {state.group && <p className="ct-note">{state.group.name}</p>}
        <progress aria-label={tr('title')} value={state.ids.length} max={Math.min(state.total ?? state.limit ?? limit, state.limit ?? limit) || 1} />
        {running && <p className="ct-note">{state.phase === 'preparing' ? tr('preparing') : state.inFlight ? tr('loading_page', { page: Math.floor(state.ids.length / GROUP_PARSER_CAPS.page) + 1 }) : tr('next_page', { seconds: Math.max(0, Math.ceil(((state.nextAt ?? now) - now) / 1000)) })}</p>}
      </div>
      {shownError && <p role="alert" className="ct-error">{tr('errors.' + shownError, { defaultValue: shownError })}</p>}
      {!ownResult && <p role="alert" className="ct-error">{tr('errors.ACCOUNT_CHANGED')}</p>}
      <InfoDisclosure title={tr('details')}><p>{tr('limits')}</p></InfoDisclosure>
    </section>
    {state.ids.length > 0 && <section className="ct-panel">
      <div className="ct-heading"><h3 className="flex items-center gap-2"><CommunitiesIcon />{tr('result', { count: state.ids.length })}</h3>
        <div className="ct-toolbar">{(['txt', 'csv', 'json'] as const).map(format => <button key={format} className="ct-button" disabled={running || !ownResult} onClick={() => exportIds(format)}><DownloadIcon />{format.toUpperCase()}</button>)}</div>
      </div>
      <p className="ct-note">{tr('use_list')}</p>
      <p className="ct-note mt-2">{state.ids.slice(0, 12).map(id => 'id' + id).join(' · ')}{state.ids.length > 12 ? ' …' : ''}</p>
    </section>}
  </div>;
}
