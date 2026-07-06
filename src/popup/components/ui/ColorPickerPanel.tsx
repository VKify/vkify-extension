import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColorPickerIcon, CheckIcon } from '../icons/Icons.js';
import {
  clamp,
  hexToHsv,
  hsvToHex,
  hsvToRgb,
  rgbToHsv,
  rgbToHsl,
  hslToRgb,
  hslToHex,
  hexToHsl,
  normalizeHex,
  type Hsv,
} from '../../utils/color.js';

/** Предустановленные цвета палитры (компактный набор тонов). */
const DEFAULT_SWATCHES: string[] = [
  '#0077FF', '#4BB34B', '#E64646', '#9B59B6',
  '#FF9500', '#E91E63', '#00BCD4', '#3F51B5',
  '#FFC107', '#8BC34A', '#1E1E2E', '#FFFFFF',
];

interface ColorPickerPanelProps {
  /** Текущий цвет `#rrggbb`. */
  value: string;
  /**
   * Непрерывное изменение (каждое движение ползунка/перетаскивание). Должно быть
   * ДЕШЁВЫМ: мгновенный preview цвета на странице, без тяжёлого React-стейта у
   * родителя — иначе перерисовка большого дерева на каждый кадр даёт лаги.
   */
  onInput: (hex: string) => void;
  /** Зафиксированное значение (отпускание ползунка, ввод, пресет) — запись/стейт. */
  onChange: (hex: string) => void;
  /** Переопределение списка пресетов. */
  presets?: string[];
}

// EyeDropper API есть в Chrome/Edge, нет в Firefox — типизируем минимально.
interface EyeDropperResult { sRGBHex: string }
interface EyeDropperCtor { new (): { open: () => Promise<EyeDropperResult> } }
const hasEyeDropper = typeof window !== 'undefined' && 'EyeDropper' in window;

/**
 * Контролируемая палитра выбора цвета (SV-область + hue + пресеты + HEX/RGB/HSL).
 *
 * Плавность: во время перетаскивания меняется только лёгкое локальное состояние
 * самой панели и зовётся `onInput` (мгновенный preview, без записи в storage и без
 * стейта родителя). Тяжёлый `onChange` (стейт + запись) — лишь на «фиксации»
 * (отпускание/ввод/пресет). Так большое дерево popup НЕ перерисовывается на каждый
 * кадр drag'а — как в нативном пикере. HSV — единственный источник истины;
 * синхронизация из `value` защищена эхо-гардом и не трогает маркер во время drag'а.
 */
export default function ColorPickerPanel({ value, onInput, onChange, presets = DEFAULT_SWATCHES }: ColorPickerPanelProps): React.ReactElement {
  const { t } = useTranslation('common');
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(normalizeHex(value) ?? '#0077ff'));

  // Свежие ссылки для обработчиков rAF/pointer (без устаревших замыканий).
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmittedRef = useRef<string>(hsvToHex(hsv.h, hsv.s, hsv.v));
  const draggingRef = useRef(false);

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);
  const currentHexRef = useRef(currentHex);
  currentHexRef.current = currentHex;
  const rgb = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const [hexText, setHexText] = useState<string>(currentHex);
  const hexFocusedRef = useRef(false);
  useEffect(() => {
    if (!hexFocusedRef.current) setHexText(currentHex);
  }, [currentHex]);

  /** Применить HSV: лёгкий локальный стейт + preview; запись — только если commit. */
  const applyHsv = useCallback((next: Hsv, commit: boolean): void => {
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    lastEmittedRef.current = hex;
    onInputRef.current(hex);
    if (commit) onChangeRef.current(hex);
  }, []);

  const applyHex = useCallback((hex: string, commit: boolean): void => {
    const norm = normalizeHex(hex);
    if (!norm) return;
    setHsv(hexToHsv(norm));
    lastEmittedRef.current = norm;
    onInputRef.current(norm);
    if (commit) onChangeRef.current(norm);
  }, []);

  /** Зафиксировать текущий цвет (отпускание ползунка SV/hue). */
  const commit = useCallback((): void => {
    onChangeRef.current(currentHexRef.current);
  }, []);

  // Внешнее изменение value → пересинхронизация HSV; не на собственные эмиты
  // (эхо-гард) и не во время перетаскивания.
  useEffect(() => {
    if (draggingRef.current) return;
    const ext = normalizeHex(value);
    if (ext && ext !== lastEmittedRef.current) {
      setHsv(hexToHsv(ext));
      lastEmittedRef.current = ext;
    }
  }, [value]);

  // --- SV-область: drag коалесцируется в один rAF/кадр, БЕЗ стейта родителя -----
  const svRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  // Считает S/V из последних координат и применяет. commit=true на отпускании
  // (фиксация значения), false — на движении (только preview).
  const applyFromCoords = useCallback((commit: boolean): void => {
    const c = coordsRef.current;
    const el = svRef.current;
    if (!c || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const s = Math.round(clamp(((c.x - r.left) / r.width) * 100, 0, 100));
    const v = Math.round(clamp((1 - (c.y - r.top) / r.height) * 100, 0, 100));
    applyHsv({ h: hsvRef.current.h, s, v }, commit);
  }, [applyHsv]);

  const flushSv = useCallback((): void => {
    rafRef.current = null;
    applyFromCoords(false);
  }, [applyFromCoords]);

  const scheduleSv = useCallback((x: number, y: number): void => {
    coordsRef.current = { x, y };
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushSv);
  }, [flushSv]);

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  const onSvPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    scheduleSv(e.clientX, e.clientY);
  }, [scheduleSv]);

  const onSvPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return;
    scheduleSv(e.clientX, e.clientY);
  }, [scheduleSv]);

  const onSvPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    // Применить последнюю позицию синхронно и сразу зафиксировать.
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    applyFromCoords(true);
  }, [applyFromCoords]);

  const onSvKeyDown = useCallback((e: React.KeyboardEvent): void => {
    const step = e.shiftKey ? 10 : 1;
    let { s, v } = hsvRef.current;
    switch (e.key) {
      case 'ArrowLeft':  s = clamp(s - step, 0, 100); break;
      case 'ArrowRight': s = clamp(s + step, 0, 100); break;
      case 'ArrowUp':    v = clamp(v + step, 0, 100); break;
      case 'ArrowDown':  v = clamp(v - step, 0, 100); break;
      default: return;
    }
    e.preventDefault();
    applyHsv({ h: hsvRef.current.h, s, v }, true);
  }, [applyHsv]);

  // --- Пипетка -------------------------------------------------------------
  const onEyeDropper = useCallback(async (): Promise<void> => {
    if (!hasEyeDropper) return;
    try {
      const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
      const res = await new Ctor().open();
      applyHex(res.sRGBHex, true);
    } catch { /* пользователь отменил */ }
  }, [applyHex]);

  // --- Поля RGB / HSL (низкочастотный ввод — фиксируем сразу) ----------------
  const setRgbChannel = (key: 'r' | 'g' | 'b', raw: string): void => {
    const n = clamp(parseInt(raw, 10) || 0, 0, 255);
    const next = { ...rgb, [key]: n };
    applyHsv(rgbToHsv(next.r, next.g, next.b), true);
  };

  const setHslChannel = (key: 'h' | 's' | 'l', raw: string): void => {
    const max = key === 'h' ? 360 : 100;
    const n = clamp(parseInt(raw, 10) || 0, 0, max);
    const next = { ...hsl, [key]: n };
    const c = hslToRgb(next.h, next.s, next.l);
    applyHsv(rgbToHsv(c.r, c.g, c.b), true);
  };

  const presetMeta = useMemo(
    () => presets.map((p) => {
      const norm = normalizeHex(p) ?? '#000000';
      return { raw: p, norm, dark: hexToHsl(norm).l <= 60 };
    }),
    [presets],
  );

  const hueColor = hslToHex(hsv.h, 100, 50);
  const numField = 'w-full text-center text-[11px] font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] rounded-md px-0.5 py-1 outline-none focus:ring-1 focus:ring-[var(--primary)] tabular-nums';
  const numLabel = 'block text-[9px] font-semibold text-[var(--text-tertiary)] text-center mb-0.5 uppercase tracking-wide';

  return (
    <div className="space-y-2.5" role="group" aria-label={t('color.group')}>
      {/* SV-область */}
      <div
        ref={svRef}
        className="relative w-full h-28 rounded-lg cursor-crosshair touch-none select-none"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
        role="slider"
        tabIndex={0}
        aria-label={t('color.sv')}
        aria-valuetext={t('color.sv_value', { s: hsv.s, v: hsv.v })}
        onPointerDown={onSvPointerDown}
        onPointerMove={onSvPointerMove}
        onPointerUp={onSvPointerUp}
        onKeyDown={onSvKeyDown}
      >
        <div
          className="absolute w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow pointer-events-none"
          style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, backgroundColor: currentHex }}
        />
      </div>

      {/* Hue-слайдер + предпросмотр */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex-shrink-0 border border-[var(--border-color)]"
          style={{ backgroundColor: currentHex }}
          aria-hidden="true"
        />
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={hsv.h}
          onChange={(e) => applyHsv({ h: parseInt(e.target.value, 10), s: hsvRef.current.s, v: hsvRef.current.v }, false)}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          aria-label={t('color.hue')}
          className="flex-1 h-3 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/20
            [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:cursor-pointer
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-black/20"
          style={{ background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)' }}
        />
      </div>

      {/* HEX + пипетка */}
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <span className={numLabel}>HEX</span>
          <input
            type="text"
            value={hexText}
            spellCheck={false}
            aria-label={t('color.hex')}
            onFocus={() => { hexFocusedRef.current = true; }}
            onChange={(e) => {
              setHexText(e.target.value);
              applyHex(e.target.value, true);
            }}
            onBlur={() => { hexFocusedRef.current = false; setHexText(currentHex); }}
            className="w-full text-center text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-secondary)] rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-[var(--primary)] uppercase"
          />
        </div>
        {hasEyeDropper && (
          <button
            type="button"
            onClick={() => { void onEyeDropper(); }}
            aria-label={t('color.eyedropper_pick')}
            title={t('color.eyedropper')}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-md bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ColorPickerIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* RGB / HSL */}
      <div className="grid grid-cols-6 gap-1">
        <div><span className={numLabel}>R</span><input type="number" min={0} max={255} value={rgb.r} aria-label={t('color.r')} onChange={(e) => setRgbChannel('r', e.target.value)} className={numField} /></div>
        <div><span className={numLabel}>G</span><input type="number" min={0} max={255} value={rgb.g} aria-label={t('color.g')} onChange={(e) => setRgbChannel('g', e.target.value)} className={numField} /></div>
        <div><span className={numLabel}>B</span><input type="number" min={0} max={255} value={rgb.b} aria-label={t('color.b')} onChange={(e) => setRgbChannel('b', e.target.value)} className={numField} /></div>
        <div><span className={numLabel}>H</span><input type="number" min={0} max={360} value={hsl.h} aria-label={t('color.h')} onChange={(e) => setHslChannel('h', e.target.value)} className={numField} /></div>
        <div><span className={numLabel}>S</span><input type="number" min={0} max={100} value={hsl.s} aria-label={t('color.s')} onChange={(e) => setHslChannel('s', e.target.value)} className={numField} /></div>
        <div><span className={numLabel}>L</span><input type="number" min={0} max={100} value={hsl.l} aria-label={t('color.l')} onChange={(e) => setHslChannel('l', e.target.value)} className={numField} /></div>
      </div>

      {/* Пресеты */}
      <div className="grid grid-cols-6 gap-1.5" role="group" aria-label={t('color.presets')}>
        {presetMeta.map((p) => {
          const active = p.norm === currentHex;
          return (
            <button
              key={p.raw}
              type="button"
              onClick={() => applyHex(p.raw, true)}
              aria-label={`Цвет ${p.raw}`}
              aria-pressed={active}
              title={p.raw}
              className="relative w-full aspect-square rounded-md border border-[var(--border-color)] transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
              style={{ backgroundColor: p.raw }}
            >
              {active && <CheckIcon className={`absolute inset-0 m-auto w-3 h-3 ${p.dark ? 'text-white' : 'text-black'}`} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
