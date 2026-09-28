import { playerIcon, setPlayerIcon } from './icons.js';
import { hideBrandTooltip } from '@/content/features/center/_shared/brand-tooltip.js';
import type { FeatureContext } from '@/content/core/feature-context.js';
import type { FeatureMap, HotkeyCombo } from '@/types/index.js';
import { createFloatingWidget } from '@/content/ui/floating-widget.js';
import { InjectedScript } from '@/content/core/injected-scripts.js';
import { waitForInjectedScript } from '@/content/utils/injected-ready.js';
import { dispatchPageEvent } from '@/content/utils/page-event.js';
import { label, time, el, button, slider, tooltip } from './ui.js';
import { musicArtworkUrl } from '@/shared/music-artwork.js';
import { createDownloadControl } from '../../download/controls.js';
import { DOWNLOAD_CONTROL_CSS } from '../../download/styles.js';
import { BUTTON_ATTR, STATUS_ATTR } from '../../download/constants.js';
import { playerToEntry } from '../../download/dom.js';
import { openPanel } from '../equalizer/panel.js';
import { ensureEqualizerStyles } from '../equalizer/styles.js';
import { DEFAULT_MEDIA_HOTKEYS } from '../player-control.js';
import { MINI_PLAYER_CSS } from './styles.js';
import { isVkVideoHost } from '../../host.js';

type Track = { id: string; title: string; artist: string; cover: string };
type State = { track: Track | null; playing: boolean; currentTime: number; duration: number; volume: number; rate: number; controllable: boolean; nextTrack?: Track | null };

export function createMiniPlayerFeature(ctx: FeatureContext): FeatureMap {
  let cleanup: (() => void) | undefined;
  let generation = 0;
  return { music_mini_player: {
    reapplyOnNavigate: true, reapplyOnLanguageChange: true,
    enable: async () => {
      cleanup?.(); cleanup = undefined;
      const run = ++generation;
      if (isVkVideoHost()) return;
      const settings = await ctx.getAllSettings();
      if (run !== generation) return;
      let disposed = false;
      let visible = settings.mini_player_open !== false;
      let state: State = { track: null, playing: false, currentTime: 0, duration: 0, volume: 1, rate: 1, controllable: false };
      let lastVolume = 1;
      let history: Track[] = [];
      try { const parsed: unknown = JSON.parse(String(settings.mini_player_history ?? '[]')); if (Array.isArray(parsed)) history = parsed.filter((x): x is Track => !!x && typeof x.id === 'string' && /^-?\d+_\d+$/.test(x.id) && typeof x.title === 'string' && typeof x.artist === 'string').slice(0, 10); } catch { /* empty history */ }
      const save = (key: string, value: unknown): void => { settings[key] = value; void ctx.setSetting(key, value); };
      const command = (action: string, value: number): void => dispatchPageEvent('vkify:mini-player:action', { action, value });
      const transport = (action: string): void => dispatchPageEvent('vkify:player:action', { action });
      const bounded = (key: string, fallback: number, min: number, max: number): number => typeof settings[key] === 'number' && Number.isFinite(settings[key]) ? Math.max(min, Math.min(max, settings[key] as number)) : fallback;
      const widget = createFloatingWidget({
        id: 'music-mini-player', title: label('title'), collapsible: true, resizable: true,
        width: bounded('mini_player_width', 340, 280, 1200), height: bounded('mini_player_height', 580, 280, 1200),
        minWidth: 280, minHeight: 280,
        startCollapsed: settings.mini_player_collapsed === true, initialPosition: 'bottom-right',
        loadPosition: () => typeof settings.mini_player_left === 'number' && typeof settings.mini_player_top === 'number' ? { left: bounded('mini_player_left', 0, 0, 100000), top: bounded('mini_player_top', 0, 0, 100000) } : null,
        onPositionChange: pos => {
          const right = Math.max(0, innerWidth - widget.root.offsetWidth), bottom = Math.max(0, innerHeight - widget.root.offsetHeight);
          const snapped = { left: pos.left < 24 ? 0 : right - pos.left < 24 ? right : pos.left, top: pos.top < 24 ? 0 : bottom - pos.top < 24 ? bottom : pos.top };
          widget.setPosition(snapped); save('mini_player_left', snapped.left); save('mini_player_top', snapped.top);
        },
        onSizeChange: size => { save('mini_player_width', Math.max(280, Math.min(1200, size.width))); save('mini_player_height', Math.min(1200, size.height)); },
        onToggle: collapsed => { save('mini_player_collapsed', collapsed); syncAnalysis(); },
        onClose: () => setVisible(false),
      });
      widget.root.classList.add('vkify-mini');
      widget.root.setAttribute('role', 'region'); widget.root.setAttribute('aria-label', label('title'));
      const style = el('style'); style.textContent = DOWNLOAD_CONTROL_CSS + MINI_PLAYER_CSS; widget.root.append(style);
      const setVisible = (value: boolean): void => { visible = value; value ? widget.show() : widget.hide(); save('mini_player_open', value); syncAnalysis(); };
      const pin = button('pin', 'pin', () => { save('mini_player_pinned', settings.mini_player_pinned !== true); applySettings(); }); pin.className = 'mp-pin';
      const mode = button('pill', 'pill', () => { save('mini_player_mode', settings.mini_player_mode === 'pill' ? 'compact' : 'pill'); applySettings(); widget.setCollapsed(true); const left = widget.root.getBoundingClientRect().left < innerWidth / 2 ? 0 : Math.max(0, innerWidth - widget.root.offsetWidth); const top = widget.root.getBoundingClientRect().top; widget.setPosition({ left, top }); save('mini_player_left', left); save('mini_player_top', top); }); mode.className = 'mp-mode';
      const compact = el('div', 'mp-compact');
      const thumb = el('img', 'mp-thumb'); thumb.alt = ''; thumb.hidden = true;
      const copy = el('div', 'mp-copy'), compactTitle = el('span'), compactArtist = el('small'); copy.append(compactTitle, compactArtist);
      const compactPrev = button('prev', 'prev', () => transport('prev'));
      const compactPlay = button('play', 'play', () => transport('play_pause'));
      const compactNext = button('next', 'next', () => transport('next'));
      const compactControls = el('div', 'mp-compact-controls');
      compactControls.append(compactPrev, compactPlay, compactNext);
      const thumbBox = el('div', 'mp-thumb-box'); thumbBox.append(playerIcon('music'), thumb);
      compact.append(thumbBox, copy, compactControls);
      widget.aux.append(compact, pin, mode);
      const thin = el('progress', 'mp-thin'); thin.max = 1; thin.setAttribute('aria-label', label('seek')); widget.root.append(thin);
      const glow = el('img', 'mp-glow'); glow.alt = ''; glow.hidden = true;
      const content = el('div', 'mp-content');
      const empty = el('div', 'mp-empty'), music = el('a', '', label('openMusic')); music.href = '/audio'; empty.append(playerIcon('music'), el('strong', '', label('empty')), music);
      const art = el('div', 'mp-art'), cover = el('img'); cover.alt = ''; cover.hidden = true; art.append(playerIcon('music'), cover);
      const title = el('a', 'mp-title'), artist = el('a', 'mp-artist');
      const seek = slider('seek', 1, 0.1), times = el('div', 'mp-time'), current = el('span', '', '0:00'), duration = el('span', '', '0:00'); times.append(current, duration);
      seek.oninput = () => { current.textContent = time(Number(seek.value)); seek.style.setProperty('--mp-progress', `${Number(seek.value) / Number(seek.max) * 100}%`); }; seek.onchange = () => command('seek', Number(seek.value));
      const controls = el('div', 'mp-transport');
      const prev = button('prev', 'prev', () => transport('prev')), play = button('play', 'play', () => transport('play_pause')), next = button('next', 'next', () => transport('next')); play.className = 'mp-play'; controls.append(prev, play, next);
      const row = el('div', 'mp-row'), volume = slider('volume', 1, 0.01);
      const mute = button('mute', 'volume', () => command('volume', state.volume > 0 ? 0 : lastVolume));
      volume.oninput = () => { const v = Number(volume.value); if (v > 0) lastVolume = v; volume.style.setProperty('--mp-progress', `${v * 100}%`); command('volume', v); };
      const rate = el('select'); rate.setAttribute('aria-label', label('rate'));
      for (let n = 0.25; n <= 3; n += 0.25) { const option = el('option', '', `${n}×`); option.value = String(n); rate.append(option); }
      rate.onchange = () => command('rate', Number(rate.value)); row.append(mute, volume, rate, button('reset', 'reset', () => command('rate', 1)));
      const tools = el('div', 'mp-tools');
      const eq = button('eq', 'eq', () => {
        save('audio_equalizer', true);
        ensureEqualizerStyles(); void openPanel();
        applySettings();
      });
      const openMusicWidget = async (feature: 'music_lyrics' | 'music_visualizer'): Promise<void> => {
        const key = feature + '_settings';
        const current = await ctx.getSetting<Record<string, unknown>>(key);
        if (disposed) return;
        await ctx.setSetting(key, { ...current, output: 'widget' });
        if (disposed) return;
        save(feature, true); applySettings();
      };
      const lyrics = button('lyrics', 'lyrics', () => { void openMusicWidget('music_lyrics'); });
      const visualizer = button('visualizer', 'visualizer', () => { void openMusicWidget('music_visualizer'); });
      const download = createDownloadControl(() => {
        const native = playerToEntry(); if (native && native.trackId === state.track?.id) return native;
        if (!state.track) return null;
        const [owner, id] = state.track.id.split('_').map(Number);
        return { trackId: state.track.id, title: state.track.title, performer: state.track.artist, coverUrl: state.track.cover, audioData: [id, owner] };
      }, 'mp-download');
      download.btn.removeAttribute(BUTTON_ATTR); download.status.removeAttribute(STATUS_ATTR);
      tools.append(eq, lyrics, visualizer, download.btn);
      tools.addEventListener('click', event => {
        if (settings.audio_download === true || !download.btn.contains(event.target as Node)) return;
        event.preventDefault(); event.stopPropagation();
        save('audio_download', true); applySettings();
      }, true);
      download.btn.querySelector('.vkify-dl-ic-ok')?.replaceChildren(playerIcon('done'));
      download.btn.querySelector('.vkify-dl-ic-err')?.replaceChildren(playerIcon('error'));
      const canvas = el('canvas'); canvas.width = 280; canvas.height = 28; canvas.setAttribute('aria-hidden', 'true');
      const upNext = el('div', 'mp-next'); upNext.hidden = true;
      const nextCopy = el('div'), nextTitle = el('span', 'mp-next-title'), nextArtist = el('span', 'mp-next-artist');
      nextCopy.append(el('span', 'mp-eyebrow', label('upNext')), nextTitle, nextArtist); upNext.append(playerIcon('queue'), nextCopy);
      const recent = el('details', 'mp-history'), summary = el('summary', '', label('history')), historyList = el('div'); summary.prepend(playerIcon('history')); recent.append(summary, historyList);
      const drawHistory = (): void => { historyList.replaceChildren(...history.map(track => { const a = el('a', '', `${track.artist} — ${track.title}`); a.href = `/audio${track.id}`; return a; })); };
      const main = el('div', 'mp-main'), metadata = el('div', 'mp-metadata'), timeline = el('div', 'mp-timeline'), footer = el('div', 'mp-footer');
      metadata.append(title, artist); timeline.append(seek, times); footer.append(upNext, recent);
      main.append(metadata, timeline, controls, row, tools, download.status, canvas, footer);
      content.append(art, main);
      widget.body.append(glow, empty, content);
      let analysisEnabled = false;
      const syncAnalysis = (): void => {
        const enabled = !disposed && visible && !widget.isCollapsed() && settings.mini_player_visualizer !== false && !document.hidden;
        if (enabled === analysisEnabled) return;
        analysisEnabled = enabled; dispatchPageEvent('vkify:visualizer:update', { enabled, consumer: 'music_mini_player' });
      };
      const applySettings = (): void => {
        widget.root.classList.toggle('is-pinned', settings.mini_player_pinned === true);
        widget.root.classList.toggle('is-pill', settings.mini_player_mode === 'pill');
        pin.setAttribute('aria-pressed', String(settings.mini_player_pinned === true));
        eq.setAttribute('aria-pressed', String(settings.audio_equalizer === true));
        lyrics.setAttribute('aria-pressed', String(settings.music_lyrics === true));
        visualizer.setAttribute('aria-pressed', String(settings.music_visualizer === true));
        download.btn.setAttribute('aria-pressed', String(settings.audio_download === true));
        tooltip(download.btn, label('download'));
        download.btn.hidden = settings.mini_player_download === false;
        download.status.hidden = download.btn.hidden; canvas.hidden = settings.mini_player_visualizer === false;
        for (const [action, b] of [['play_pause', play], ['prev', prev], ['next', next]] as const) {
          const combo = settings[`media_hotkey_${action}`] as HotkeyCombo | undefined;
          const key = action === 'play_pause' ? 'play' : action;
          tooltip(b, `${label(key)}${settings.media_player_hotkeys === true ? ` · ${combo?.label ?? DEFAULT_MEDIA_HOTKEYS[action].label}` : ''}`);
        }
        tooltip(compactPrev, prev.dataset.tooltip || label('prev'));
        tooltip(compactPlay, play.dataset.tooltip || label('play'));
        tooltip(compactNext, next.dataset.tooltip || label('next'));
        syncAnalysis();
      };
      const onState = (event: Event): void => {
        const data = (event as CustomEvent<State>).detail;
        if (!data || ![data.currentTime, data.duration, data.volume, data.rate].every(Number.isFinite)) return;
        const track = data.track;
        if (track && (typeof track.id !== 'string' || !/^-?\d+_\d+$/.test(track.id) || typeof track.title !== 'string' || typeof track.artist !== 'string')) return;
        const wasPlaying = state.playing, changed = state.track?.id !== track?.id;
        state = { ...data, currentTime: Math.max(0, data.currentTime), duration: Math.max(0, data.duration), track: track ? { ...track, title: track.title.slice(0, 500), artist: track.artist.slice(0, 500), cover: musicArtworkUrl(track.cover) } : null };
        // An explicit close/show-off persists across reloads. Auto-show may
        // reveal the player only while that visibility preference is open.
        if (!wasPlaying && state.playing && settings.mini_player_open !== false && settings.mini_player_auto_show !== false) setVisible(true);
        content.hidden = !state.track; empty.hidden = !!state.track;
        compactTitle.textContent = state.track?.title || label('empty'); compactArtist.textContent = state.track?.artist ?? ''; copy.classList.toggle('is-overflow', compactTitle.scrollWidth > copy.clientWidth);
        title.textContent = state.track?.title ?? ''; artist.textContent = state.track?.artist ?? '';
        title.href = state.track ? `/audio${state.track.id}` : '/audio'; artist.href = `/audio?q=${encodeURIComponent(state.track?.artist ?? '')}`;
        const src = state.track?.cover ?? '';
        for (const image of [cover, thumb, glow]) if (image.dataset.src !== src) {
          image.dataset.src = src; image.hidden = !src;
          if (src) { image.src = src; image.onerror = () => { image.hidden = true; }; } else image.removeAttribute('src');
        }
        setPlayerIcon(play, state.playing ? 'pause' : 'play'); setPlayerIcon(compactPlay, state.playing ? 'pause' : 'play'); setPlayerIcon(mute, state.volume === 0 ? 'mute' : 'volume');
        play.setAttribute('aria-pressed', String(state.playing)); compactPlay.setAttribute('aria-pressed', String(state.playing));
        seek.disabled = !state.controllable || state.duration <= 0; volume.disabled = rate.disabled = !state.controllable;
        if (document.activeElement !== seek) { seek.max = String(state.duration || 1); seek.value = String(state.currentTime); current.textContent = time(state.currentTime); seek.style.setProperty('--mp-progress', `${state.duration ? Math.min(100, state.currentTime / state.duration * 100) : 0}%`); }
        duration.textContent = time(state.duration); thin.value = state.duration ? Math.min(1, state.currentTime / state.duration) : 0;
        if (document.activeElement !== volume) { volume.value = String(state.volume); volume.style.setProperty('--mp-progress', `${state.volume * 100}%`); }
        if (document.activeElement !== rate) rate.value = String(state.rate);
        mute.setAttribute('aria-pressed', String(state.volume === 0));
        if (state.volume > 0) lastVolume = state.volume;
        const upcoming = data.nextTrack;
        const hasNext = !!upcoming && typeof upcoming.title === 'string' && typeof upcoming.artist === 'string' && !!upcoming.title.trim();
        upNext.hidden = !hasNext;
        nextTitle.textContent = hasNext ? upcoming.title.slice(0, 300) : '';
        nextArtist.textContent = hasNext ? upcoming.artist.slice(0, 300) : '';
        if (changed && state.track) { history = [state.track, ...history.filter(x => x.id !== state.track!.id)].slice(0, 10); save('mini_player_history', JSON.stringify(history)); drawHistory(); }
        if (changed && !matchMedia('(prefers-reduced-motion: reduce)').matches) cover.animate?.([{ opacity: 0.2, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }], { duration: 350 });
      };
      let lastDraw = 0;
      const onAnalysis = (event: Event): void => {
        if (!analysisEnabled || performance.now() - lastDraw < 65) return;
        const spectrum: unknown = (event as CustomEvent).detail?.spectrum;
        if (!Array.isArray(spectrum) || spectrum.length > 4096) return;
        lastDraw = performance.now(); const c = canvas.getContext('2d'); if (!c) return;
        c.clearRect(0, 0, 280, 28); c.fillStyle = getComputedStyle(widget.root).getPropertyValue('--vkui--color_background_accent').trim() || '#7795ff';
        for (let i = 0; i < 40; i++) { const v = Number(spectrum[Math.floor(i * spectrum.length / 40)]); const h = Number.isFinite(v) ? Math.max(2, Math.min(28, v <= 1 ? v * 28 : v / 255 * 28)) : 2; c.fillRect(i * 7, 28 - h, 4, h); }
      };
      const onKey = (event: KeyboardEvent): void => {
        if (event.repeat || event.defaultPrevented || event.metaKey || (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest('input,textarea,select')))) return;
        const combo = String(settings.mini_player_hotkey ?? 'Alt+M').split('+');
        if (event.altKey !== combo.includes('Alt') || event.ctrlKey !== combo.includes('Ctrl') || event.shiftKey !== combo.includes('Shift')) return;
        const key = combo[combo.length - 1] ?? ''; if (event.code !== key && event.code !== `Key${key.toUpperCase()}`) return;
        event.preventDefault(); setVisible(!visible);
      };
      const request = (): void => { widget.reattach(); dispatchPageEvent('vkify:mini-player:request'); };
      window.addEventListener('vkify:mini-player:state', onState);
      window.addEventListener('vkify:visualizer:data', onAnalysis);
      document.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', syncAnalysis);
      const offStore = ctx.onStorageChange((key, value) => {
        settings[key] = value;
        if (key === 'mini_player_open') { visible = value !== false; visible ? widget.show() : widget.hide(); }
        if (key === 'mini_player_collapsed') widget.setCollapsed(value === true);
        applySettings();
      });
      const timer = window.setInterval(request, 250);
      cleanup = () => {
        disposed = true; clearInterval(timer); offStore();
        window.removeEventListener('vkify:mini-player:state', onState); window.removeEventListener('vkify:visualizer:data', onAnalysis);
        document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', syncAnalysis);
        syncAnalysis(); hideBrandTooltip(); download.destroy(); widget.destroy();
      };
      widget.body.removeAttribute('title');
      widget.mount(); if (!visible) widget.hide(); drawHistory(); applySettings();
      const ready = waitForInjectedScript(InjectedScript.EQUALIZER);
      ctx.injectScript(InjectedScript.PLAYER_CONTROL); ctx.injectScript(InjectedScript.EQUALIZER);
      await ready;
      if (disposed || run !== generation) return;
      analysisEnabled = false; syncAnalysis(); request();
    },
    disable: () => { generation++; cleanup?.(); cleanup = undefined; },
  } };
}
