/**
 * Плавающая панель эквалайзера на vk.com (ванильный TS поверх createFloatingWidget).
 *
 * Источник правды — chrome.storage. Настройки EQ — ключи audio_equalizer_*;
 * UI-состояние самой панели (позиция/открыта/свёрнута) — device-local ключи
 * equalizerPosition / equalizerPanelOpen / equalizerPanelCollapsed (как
 * perfWidgetPosition; см. isNonUiStateKey). Панель:
 *   • при открытии читает настройки и рисует ползунки/пресеты;
 *   • на input ползунка — мгновенно шлёт значения в page-world DSP
 *     (dispatchPageEvent) для плавного звука + дебаунс-пишет в storage (персист);
 *   • слушает storage.onChange — отражает правки из попапа (с защитой от эха и
 *     от перерисовки во время перетаскивания);
 *   • сворачивается в компактный бар (заголовок + быстрый выбор пресета в шапке);
 *   • сохраняет позицию и состояние, восстанавливается при загрузке страницы.
 *
 * Мастер вкл/выкл живёт в попапе (тумблер audio_equalizer = id фичи): когда фича
 * выключается, FeatureManager зовёт disable() и панель уничтожается целиком.
 */
import { createFloatingWidget, type FloatingWidgetHandle, type FloatingWidgetPosition } from '@/content/ui/floating-widget.js';
import { storage } from '@/content/core/storage.js';
import { dispatchPageEvent } from '@/content/utils/page-event.js';
import type { EqualizerPreset } from '@/types/index.js';
import {
  EQ_FREQUENCIES, EQ_GAIN_MIN, EQ_GAIN_MAX, CUSTOM_PRESET_ID, FLAT_BANDS,
  BUILTIN_PRESETS, bandLabel, normalizeBands, clampGain, findPreset,
} from './presets.js';
import { setEqualizerButtonActive } from './button.js';
import { t } from '@/content/i18n/index.js';

const KEY_PREAMP    = 'audio_equalizer_preamp';
const KEY_BANDS     = 'audio_equalizer_bands';
const KEY_PRESET    = 'audio_equalizer_preset';
const KEY_CUSTOM    = 'audio_equalizer_custom_presets';
// Device-local UI-state панели (вне settings-UI/экспорта — см. isNonUiStateKey).
const KEY_POSITION  = 'equalizerPosition';
const KEY_OPEN      = 'equalizerPanelOpen';
const KEY_COLLAPSED = 'equalizerPanelCollapsed';

// ── Локальное состояние панели ────────────────────────────────────────────────
let widget: FloatingWidgetHandle | null = null;
let offStorage: (() => void) | null = null;
let panelOpen = false;       // видимость (isMounted() остаётся true после hide())

let preamp = 0;
let bands: number[] = [...FLAT_BANDS];
let presetId = 'flat';
let custom: EqualizerPreset[] = [];

let isDragging = false;
let selfEchoUntil = 0;       // игнор storage.onChange сразу после собственной записи
let persistTimer: number | undefined;

// Ссылки на DOM для обновления без полной перерисовки.
let presetsWrap: HTMLElement | null = null;
let bandSliders: HTMLInputElement[] = [];
let bandVals: HTMLElement[] = [];
let preampSlider: HTMLInputElement | null = null;
let preampVal: HTMLElement | null = null;
let auxSelect: HTMLSelectElement | null = null;   // быстрый выбор пресета в шапке

// ── Хелперы ──────────────────────────────────────────────────────────────────

function genId(): string {
  return `eq_${Date.now().toString(36)}`;
}

// Перетаскивание может завершиться вне ползунка → ловим отпускание на window.
const onPointerUp = (): void => { isDragging = false; };

function fmtDb(db: number): string {
  const r = Math.round(db);
  return r > 0 ? `+${r}` : String(r);
}

/** Мгновенно применить текущее состояние к DSP в page-world. */
function pushToDsp(): void {
  dispatchPageEvent('vkify:equalizer:update', { enabled: true, preamp, bands });
}

/** Дебаунс-персист текущего состояния (preamp/bands/preset). */
function schedulePersist(): void {
  selfEchoUntil = Date.now() + 500;
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    void storage.setMultiple({ [KEY_PREAMP]: preamp, [KEY_BANDS]: bands, [KEY_PRESET]: presetId });
  }, 80);
}

async function persistNow(extra: Record<string, unknown> = {}): Promise<void> {
  selfEchoUntil = Date.now() + 500;
  await storage.setMultiple({ [KEY_PREAMP]: preamp, [KEY_BANDS]: bands, [KEY_PRESET]: presetId, ...extra });
}

// ── Загрузка состояния из storage ─────────────────────────────────────────────

async function loadState(): Promise<void> {
  preamp = clampGain(Number(await storage.get<number>(KEY_PREAMP, 0)) || 0);
  bands = normalizeBands(await storage.get<number[]>(KEY_BANDS, [...FLAT_BANDS]));
  presetId = String(await storage.get<string>(KEY_PRESET, 'flat') ?? 'flat');
  custom = (await storage.get<EqualizerPreset[]>(KEY_CUSTOM, [])) ?? [];
}

// ── Рендеринг ────────────────────────────────────────────────────────────────

function renderPresetChips(): void {
  if (!presetsWrap) return;
  presetsWrap.replaceChildren();

  const all: { preset: EqualizerPreset; removable: boolean }[] = [
    ...BUILTIN_PRESETS.map(p => ({ preset: p, removable: false })),
    ...custom.map(p => ({ preset: p, removable: true })),
  ];

  for (const { preset, removable } of all) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'vkify-eq__preset' + (removable ? ' vkify-eq__preset--custom' : '');
    chip.textContent = preset.name;
    chip.dataset.presetId = preset.id;
    chip.addEventListener('click', () => applyPreset(preset));

    if (removable) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'vkify-eq__preset-del';
      del.textContent = '×';
      del.title = t('equalizer.delete_preset');
      del.addEventListener('click', (e) => { e.stopPropagation(); void deleteCustomPreset(preset.id); });
      chip.appendChild(del);
    }
    presetsWrap.appendChild(chip);
  }
  renderAuxSelect();
  highlightActivePreset();
}

function highlightActivePreset(): void {
  if (presetsWrap) {
    presetsWrap.querySelectorAll<HTMLElement>('.vkify-eq__preset').forEach(chip => {
      chip.classList.toggle('is-active', chip.dataset.presetId === presetId);
    });
  }
  if (auxSelect) auxSelect.value = presetId;
}

/** Быстрый выбор пресета в шапке (доступен и в свёрнутом состоянии). */
function buildAuxSelect(): HTMLSelectElement {
  const sel = document.createElement('select');
  sel.className = 'vkify-eq__aux-select';
  sel.title = t('equalizer.preset');
  sel.addEventListener('pointerdown', (e) => e.stopPropagation()); // не тащить шапку
  sel.addEventListener('change', () => {
    const id = sel.value;
    if (id === CUSTOM_PRESET_ID) { presetId = CUSTOM_PRESET_ID; highlightActivePreset(); return; }
    const p = findPreset(id, custom);
    if (p) applyPreset(p);
  });
  return sel;
}

/** Пересобрать опции селектора пресетов (встроенные + пользовательские + Custom). */
function renderAuxSelect(): void {
  if (!auxSelect) return;
  auxSelect.replaceChildren();
  const add = (id: string, name: string): void => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = name;
    auxSelect!.appendChild(o);
  };
  for (const p of BUILTIN_PRESETS) add(p.id, p.name);
  for (const p of custom) add(p.id, p.name);
  add(CUSTOM_PRESET_ID, t('equalizer.custom_settings'));
  auxSelect.value = presetId;
}

/** Обновить позиции ползунков и подписи по текущему состоянию. */
function syncControls(): void {
  for (let i = 0; i < bandSliders.length; i++) {
    bandSliders[i].value = String(Math.round(bands[i] ?? 0));
    bandVals[i].textContent = fmtDb(bands[i] ?? 0);
  }
  if (preampSlider) preampSlider.value = String(Math.round(preamp));
  if (preampVal) preampVal.textContent = fmtDb(preamp);
  highlightActivePreset();
}

function buildBand(
  label: string,
  initial: number,
  modifier: string,
  onInput: (v: number) => void,
): { wrap: HTMLElement; slider: HTMLInputElement; val: HTMLElement } {
  const wrap = document.createElement('div');
  wrap.className = 'vkify-eq__band' + modifier;

  const val = document.createElement('span');
  val.className = 'vkify-eq__val';
  val.textContent = fmtDb(initial);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'vkify-eq__slider';
  // Старые Firefox (< 124) не знают writing-mode для range — там вертикаль
  // даёт этот атрибут; современные браузеры его игнорируют (работает CSS).
  slider.setAttribute('orient', 'vertical');
  slider.min = String(EQ_GAIN_MIN);
  slider.max = String(EQ_GAIN_MAX);
  slider.step = '1';
  slider.value = String(Math.round(initial));
  slider.addEventListener('input', () => {
    const v = clampGain(Number(slider.value));
    val.textContent = fmtDb(v);
    onInput(v);
  });

  const freq = document.createElement('span');
  freq.className = 'vkify-eq__freq';
  freq.textContent = label;

  wrap.append(val, slider, freq);
  return { wrap, slider, val };
}

function buildBody(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'vkify-eq';

  // Пресеты
  presetsWrap = document.createElement('div');
  presetsWrap.className = 'vkify-eq__presets';
  root.appendChild(presetsWrap);

  // Полосы (преамп + 10 частот)
  const sliders = document.createElement('div');
  sliders.className = 'vkify-eq__sliders';
  sliders.addEventListener('pointerdown', () => { isDragging = true; });

  const pre = buildBand('Pre', preamp, ' vkify-eq__band--pre', (v) => {
    preamp = v;
    onManualEdit();
  });
  preampSlider = pre.slider;
  preampVal = pre.val;
  sliders.appendChild(pre.wrap);

  bandSliders = [];
  bandVals = [];
  EQ_FREQUENCIES.forEach((hz, i) => {
    const b = buildBand(bandLabel(hz), bands[i] ?? 0, '', (v) => {
      bands[i] = v;
      onManualEdit();
    });
    bandSliders.push(b.slider);
    bandVals.push(b.val);
    sliders.appendChild(b.wrap);
  });
  root.appendChild(sliders);

  // Действия
  const actions = document.createElement('div');
  actions.className = 'vkify-eq__actions';

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'vkify-eq__btn';
  reset.textContent = t('equalizer.reset');
  reset.addEventListener('click', () => applyPreset(BUILTIN_PRESETS[0]));

  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'vkify-eq__btn vkify-eq__btn--accent';
  save.textContent = t('equalizer.save_preset');
  save.addEventListener('click', () => void saveCustomPreset());

  actions.append(reset, save);
  root.appendChild(actions);

  renderPresetChips();
  return root;
}

// ── Действия ──────────────────────────────────────────────────────────────────

/** Ручная правка ползунка → состояние «custom», мгновенно в DSP, дебаунс-персист. */
function onManualEdit(): void {
  presetId = CUSTOM_PRESET_ID;
  highlightActivePreset();
  pushToDsp();
  schedulePersist();
}

function applyPreset(preset: EqualizerPreset): void {
  preamp = clampGain(preset.preamp);
  bands = normalizeBands(preset.bands);
  presetId = preset.id;
  syncControls();
  pushToDsp();
  void persistNow();
}

async function saveCustomPreset(): Promise<void> {
  const name = window.prompt(t('equalizer.prompt_name'), t('equalizer.prompt_default'));
  if (name == null) return;
  const trimmed = name.trim();
  if (!trimmed) return;

  const preset: EqualizerPreset = { id: genId(), name: trimmed, preamp, bands: [...bands] };
  custom = [...custom, preset];
  presetId = preset.id;
  renderPresetChips();
  await persistNow({ [KEY_CUSTOM]: custom });
}

async function deleteCustomPreset(id: string): Promise<void> {
  custom = custom.filter(p => p.id !== id);
  if (presetId === id) presetId = CUSTOM_PRESET_ID;
  renderPresetChips();
  await persistNow({ [KEY_CUSTOM]: custom });
}

// ── Реакция на внешние изменения storage (попап) ──────────────────────────────

function onStorageChange(key: string): void {
  if (!widget) return;
  if (!key.startsWith('audio_equalizer')) return;
  if (Date.now() < selfEchoUntil) return;   // наша же запись — игнор
  if (isDragging) return;                    // не дёргаем ползунки под пальцем
  void loadState().then(() => {
    renderPresetChips();
    syncControls();
  });
}

// ── Публичный API ─────────────────────────────────────────────────────────────

// Позиция — в chrome.storage (как perfWidgetPosition), а не в localStorage:
// переживает любой контекст и сбрасывается единообразно.
function loadPosition(): Promise<FloatingWidgetPosition | null> {
  return storage.get<FloatingWidgetPosition>(KEY_POSITION, null);
}

function savePosition(pos: FloatingWidgetPosition): void {
  void storage.set(KEY_POSITION, pos);
}

export function isPanelOpen(): boolean {
  return panelOpen;
}

export async function openPanel(): Promise<void> {
  panelOpen = true;
  void storage.set(KEY_OPEN, true);
  if (widget) { widget.reattach(); widget.show(); widget.bringToFront(); setEqualizerButtonActive(true); return; }

  await loadState();
  const collapsed = (await storage.get<boolean>(KEY_COLLAPSED, false)) === true;

  widget = createFloatingWidget({
    id: 'equalizer',
    title: t('equalizer.title'),
    width: 320,
    closable: true,
    closeTitle: t('equalizer.close'),
    collapsible: true,
    startCollapsed: collapsed,
    initialPosition: 'bottom-right',
    loadPosition,
    onPositionChange: savePosition,
    onToggle: (isCollapsed) => { void storage.set(KEY_COLLAPSED, isCollapsed); },
    onClose: () => closePanel(),
  });

  // Быстрый выбор пресета — в шапку (виден и когда тело свёрнуто).
  auxSelect = buildAuxSelect();
  widget.aux.appendChild(auxSelect);

  widget.body.appendChild(buildBody());
  syncControls();
  widget.mount();
  widget.bringToFront();

  window.addEventListener('pointerup', onPointerUp);
  offStorage?.();
  offStorage = storage.onChange((key) => onStorageChange(key));
  setEqualizerButtonActive(true);
}

export function closePanel(): void {
  panelOpen = false;
  void storage.set(KEY_OPEN, false);
  setEqualizerButtonActive(false);
  if (widget) { widget.hide(); }
}

export function togglePanel(): void {
  if (isPanelOpen()) closePanel();
  else void openPanel();
}

/** Полная очистка при выключении фичи. */
export function destroyPanel(): void {
  panelOpen = false;
  window.clearTimeout(persistTimer);
  window.removeEventListener('pointerup', onPointerUp);
  offStorage?.();
  offStorage = null;
  widget?.destroy();
  widget = null;
  presetsWrap = null;
  bandSliders = [];
  bandVals = [];
  preampSlider = null;
  preampVal = null;
  auxSelect = null;
  setEqualizerButtonActive(false);
}
