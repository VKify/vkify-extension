import { useCallback, useEffect, useRef, useState } from 'react';
import { sendMessage } from '@/shared/messaging.js';
import { MEDIA_TYPES, dialogPage, filePage, groupPage, mergeRows, wallActivity, type GlobalToolFile, type MediaType, type ToolDialog, type ToolFile, type ToolGroup } from '@/shared/center-tools.js';

class ToolApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export async function api(method: string, params: Record<string, unknown>): Promise<unknown> {
  const result = await sendMessage({ type: 'VK_API_CALL', method, params });
  if (!result.success || result.data == null) throw new ToolApiError(String(result.code ?? ''), result.error ?? 'API_UNAVAILABLE');
  return result.data;
}
function errorKey(error: unknown): string {
  if (error instanceof ToolApiError && ['5', '7', '15', '200', '201', '203', '917', 'no_token', 'no_vk_tab', 'expired', 'TOKEN_EXPIRED'].includes(error.code)) return 'access_error';
  return 'request_error';
}
/** A cancelled response never updates a different dialog/filter or an unmounted page. */
export function useTask() {
  const version = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useCallback(() => { version.current++; setBusy(false); }, []);
  useEffect(() => () => { version.current++; }, []);
  const run = useCallback(async (job: (current: () => boolean) => Promise<void>) => {
    const id = ++version.current;
    const current = () => version.current === id;
    setBusy(true); setError(null);
    try { await job(current); } catch (error) { if (current()) setError(errorKey(error)); }
    finally { if (current()) setBusy(false); }
  }, []);
  return { busy, error, cancel, run };
}

interface FileJob { dialog: ToolDialog; type: MediaType; cursor?: string }
const pauseRequests = () => new Promise(resolve => setTimeout(resolve, 400));

/** Breadth-first media library: one page per dialog/type, then older pages on demand. */
export function useGlobalDialogFiles(ownerId: string | null) {
  const [dialogs, setDialogs] = useState<ToolDialog[]>([]);
  const [files, setFiles] = useState<GlobalToolFile[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [phase, setPhase] = useState<'idle' | 'dialogs' | 'files' | 'ready'>('idle');
  const [pending, setPending] = useState(0);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [covered, setCovered] = useState<number[]>([]);
  const queue = useRef<FileJob[]>([]), later = useRef<FileJob[]>([]);
  const denied = useRef(new Set<number>()), visited = useRef(new Set<number>());
  const indexed = useRef(false);
  const task = useTask();
  const { cancel } = task;
  useEffect(() => {
    cancel(); setDialogs([]); setFiles([]); setProgress({ done: 0, total: 0 }); setPhase('idle');
    setPending(0); setSkipped([]); setCovered([]); queue.current = []; later.current = [];
    denied.current = new Set(); visited.current = new Set(); indexed.current = false;
  }, [ownerId, cancel]);
  const load = (reset = false) => task.run(async current => {
    if (reset) {
      indexed.current = false; queue.current = []; later.current = [];
      denied.current = new Set(); visited.current = new Set();
      setFiles([]); setDialogs([]); setSkipped([]); setCovered([]); setPending(0);
    }
    if (!indexed.current) {
      setPhase('dialogs'); setProgress({ done: 0, total: 0 });
      let all: ToolDialog[] = [], offset = 0;
      while (current()) {
        const page = dialogPage(await api('messages.getConversations', { offset, count: 200, extended: 1, fields: 'photo_100' }));
        if (!current()) return;
        all = mergeRows(all, page.rows, row => row.id); offset += page.consumed;
        setDialogs(all); setProgress({ done: offset, total: page.count });
        if (!page.consumed || offset >= page.count) break;
        await pauseRequests();
      }
      if (!current()) return;
      queue.current = all.flatMap(dialog => MEDIA_TYPES.map(type => ({ dialog, type })));
      indexed.current = true;
      // Separate conversation discovery and attachment calls by the same pacing.
      if (queue.current.length) await pauseRequests();
    }
    if (!current()) return;
    if (!queue.current.length) { queue.current = later.current; later.current = []; }
    const roundTotal = queue.current.length;
    setPhase('files'); setProgress({ done: 0, total: roundTotal });
    setPending(queue.current.length + later.current.length);
    let done = 0;
    while (current() && queue.current.length) {
      const job = queue.current[0]!;
      let next: string | null = null;
      if (!denied.current.has(job.dialog.id)) {
        try {
          const result = filePage(await api('messages.getHistoryAttachments', {
            peer_id: job.dialog.id, media_type: job.type, count: 30,
            ...(job.cursor ? { start_from: job.cursor } : {}),
          }), job.type);
          if (!current()) return;
          const rows = result.rows.map(file => ({ ...file, key: `${job.dialog.id}:${file.key}`, peerId: job.dialog.id, dialogTitle: job.dialog.title }));
          setFiles(old => mergeRows(old, rows, file => file.key));
          next = result.next === job.cursor ? null : result.next;
          visited.current.add(job.dialog.id); setCovered([...visited.current]);
        } catch (error) {
          if (!current()) return;
          // A restricted conversation is skipped; account-wide permission/rate errors
          // stop the queue with the current job intact so retry can resume it.
          if (!(error instanceof ToolApiError) || !['15', '18', '917'].includes(error.code)) throw error;
          denied.current.add(job.dialog.id); setSkipped([...denied.current]);
        }
      }
      if (!current()) return;
      queue.current.shift();
      if (next) later.current.push({ ...job, cursor: next });
      setProgress({ done: ++done, total: roundTotal });
      setPending(queue.current.length + later.current.length);
      if (queue.current.length) await pauseRequests();
    }
    if (current()) setPhase('ready');
  });
  return { dialogs, files, covered, skipped, pending, progress, phase, load, ...task };
}

export function useDialogFiles(ownerId: string | null) {
  const [dialogs, setDialogs] = useState<ToolDialog[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [peer, setPeer] = useState<number | null>(null);
  const [type, setType] = useState<MediaType>('photo');
  const [files, setFiles] = useState<ToolFile[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const dialogTask = useTask(), fileTask = useTask();
  const { run: runDialogs, cancel: cancelDialogs } = dialogTask, { run: runFiles, cancel: cancelFiles } = fileTask;
  useEffect(() => {
    cancelDialogs(); cancelFiles(); setDialogs([]); setPeer(null); setTotal(null); setOffset(0);
    setFiles([]); setNext(null); setLoaded(false);
  }, [ownerId, cancelDialogs, cancelFiles]);
  const loadDialogs = (reset = false) => runDialogs(async current => {
    const page = dialogPage(await api('messages.getConversations', { offset: reset ? 0 : offset, count: 100, extended: 1, fields: 'photo_100' }));
    if (!current()) return;
    setDialogs(old => reset ? page.rows : mergeRows(old, page.rows, row => row.id));
    setOffset((reset ? 0 : offset) + page.consumed);
    setTotal(page.consumed ? page.count : reset ? 0 : offset);
  });
  const loadFiles = useCallback((reset = false) => {
    if (peer === null) return Promise.resolve();
    return runFiles(async current => {
      const page = filePage(await api('messages.getHistoryAttachments', {
        peer_id: peer, media_type: type, count: 60, ...(reset || !next ? {} : { start_from: next }),
      }), type);
      if (!current()) return;
      setFiles(old => reset ? page.rows : mergeRows(old, page.rows, row => row.key));
      setNext(page.next === next && !reset ? null : page.next); setLoaded(true);
    });
  }, [peer, type, next, runFiles]);
  useEffect(() => {
    cancelFiles(); setFiles([]); setNext(null); setLoaded(false);
    // Explicit load keeps API requests under user control; no background polling.
  }, [peer, type, cancelFiles]);
  return { dialogs, total, moreDialogs: total === null || offset < total, peer, setPeer, type, setType,
    files, next, loaded, loadDialogs, loadFiles, dialogTask, fileTask };
}

export function useSubscriptions(ownerId: string | null) {
  const [groups, setGroups] = useState<ToolGroup[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const task = useTask();
  const { cancel } = task;
  useEffect(() => {
    cancel(); setGroups([]); setTotal(null); setOffset(0); setProgress({ done: 0, total: 0 });
  }, [ownerId, cancel]);
  const load = (reset = false) => task.run(async current => {
    const page = groupPage(await api('groups.get', { extended: 1, fields: 'members_count', count: 500, offset: reset ? 0 : offset }));
    if (!current()) return;
    setGroups(old => reset ? page.rows : mergeRows(old, page.rows, row => row.id));
    setOffset((reset ? 0 : offset) + page.consumed); setTotal(page.consumed ? page.count : reset ? 0 : offset);
    setProgress({ done: 0, total: 0 });
  });
  const analyze = (days: number) => task.run(async current => {
    const targets = groups.filter(g => !g.deactivated);
    setProgress({ done: 0, total: targets.length });
    for (let i = 0; i < targets.length; i++) {
      if (!current()) return;
      const group = targets[i]!;
      let activity: Pick<ToolGroup, 'activity' | 'lastPost'>;
      try { activity = wallActivity(await api('wall.get', { owner_id: -group.id, count: 2, filter: 'owner' }), days); }
      catch (error) {
        if (!(error instanceof ToolApiError) || ['5', '6', '7', '9', '29', 'no_token', 'no_vk_tab', 'expired', 'TOKEN_EXPIRED'].includes(error.code)) throw error;
        activity = { activity: error instanceof ToolApiError && ['15', '18', '19', '203'].includes(error.code) ? 'unavailable' : 'error', lastPost: null };
      }
      if (!current()) return;
      setGroups(old => old.map(g => g.id === group.id ? { ...g, ...activity } : g));
      setProgress({ done: i + 1, total: targets.length });
      // Keep below VK's request limit; closing the page or cancelling stops the queue.
      if (i < targets.length - 1) await new Promise(resolve => setTimeout(resolve, 400));
    }
  });
  return { groups, total, more: total === null || offset < total, progress, load, analyze, ...task };
}
