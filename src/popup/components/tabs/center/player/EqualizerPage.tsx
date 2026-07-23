import React from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection from '@/popup/components/ui/SettingsSection.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { EqualizerIcon, InfoIcon } from '@/popup/components/icons/Icons.js';
import type { EqualizerPreset } from '@/types/index.js';
import {
  EQ_FREQUENCIES, EQ_GAIN_MIN, EQ_GAIN_MAX, CUSTOM_PRESET_ID, FLAT_BANDS,
  BUILTIN_PRESETS, bandLabel, normalizeBands, clampGain,
} from '@/content/features/center/player/equalizer/presets.js';

const KEY_PREAMP = 'audio_equalizer_preamp';
const KEY_BANDS  = 'audio_equalizer_bands';
const KEY_PRESET = 'audio_equalizer_preset';
const KEY_CUSTOM = 'audio_equalizer_custom_presets';

function fmtDb(db: number): string {
  const r = Math.round(db);
  return r > 0 ? `+${r}` : String(r);
}

/**
 * Подстраница «Музыка → Эквалайзер». 10-полосный Web Audio EQ над плеером VK:
 * мастер-тумблер + преамп/полосы + пресеты (встроенные read-only и именованные
 * пользовательские). Источник правды — chrome.storage; правки тут же применяются
 * к воспроизведению (контент-мост пересылает значения в page-world DSP).
 */
export default function EqualizerPage(): React.ReactElement {
  const { t } = useTranslation('center');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const enabled = settings['audio_equalizer'] === true;

  const savedPreamp = clampGain(Number(settings[KEY_PREAMP] ?? 0) || 0);
  const savedBands = normalizeBands(settings[KEY_BANDS] as number[] | undefined ?? [...FLAT_BANDS]);
  const savedPreset = String(settings[KEY_PRESET] ?? 'flat');
  const custom = (settings[KEY_CUSTOM] as EqualizerPreset[] | undefined) ?? [];

  // Локальный черновик для плавного перетаскивания; ресинк при внешних правках
  // (например, из плавающей панели на vk.ru).
  const [preamp, setPreamp] = React.useState(savedPreamp);
  const [bands, setBands] = React.useState<number[]>(savedBands);
  const [presetId, setPresetId] = React.useState(savedPreset);
  const persistTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    setPreamp(savedPreamp);
    setBands(savedBands);
    setPresetId(savedPreset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedPreamp, savedPreset, JSON.stringify(savedBands)]);

  const persist = (next: { preamp: number; bands: number[]; presetId: string }): void => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      void saveSetting(KEY_PREAMP, next.preamp);
      void saveSetting(KEY_BANDS, next.bands);
      void saveSetting(KEY_PRESET, next.presetId);
    }, 90);
  };

  const onBand = (i: number, v: number): void => {
    const next = bands.slice();
    next[i] = clampGain(v);
    setBands(next);
    setPresetId(CUSTOM_PRESET_ID);
    persist({ preamp, bands: next, presetId: CUSTOM_PRESET_ID });
  };

  const onPreamp = (v: number): void => {
    const p = clampGain(v);
    setPreamp(p);
    setPresetId(CUSTOM_PRESET_ID);
    persist({ preamp: p, bands, presetId: CUSTOM_PRESET_ID });
  };

  const applyPreset = (preset: EqualizerPreset): void => {
    const p = clampGain(preset.preamp);
    const b = normalizeBands(preset.bands);
    setPreamp(p);
    setBands(b);
    setPresetId(preset.id);
    void saveSetting(KEY_PREAMP, p);
    void saveSetting(KEY_BANDS, b);
    void saveSetting(KEY_PRESET, preset.id);
  };

  const saveCustom = (): void => {
    const name = window.prompt(t('player.eq.prompt_name'), t('player.eq.prompt_default'));
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset: EqualizerPreset = { id: `eq_${Date.now().toString(36)}`, name: trimmed, preamp, bands: bands.slice() };
    const list = [...custom, preset];
    setPresetId(preset.id);
    void saveSetting(KEY_CUSTOM, list);
    void saveSetting(KEY_PRESET, preset.id);
  };

  const deleteCustom = (id: string): void => {
    const list = custom.filter((p) => p.id !== id);
    void saveSetting(KEY_CUSTOM, list);
    if (presetId === id) {
      setPresetId(CUSTOM_PRESET_ID);
      void saveSetting(KEY_PRESET, CUSTOM_PRESET_ID);
    }
  };

  const VerticalSlider = ({
    id, label, value, accent, onChange,
  }: { id: string; label: string; value: number; accent?: boolean; onChange: (v: number) => void }): React.ReactElement => (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <span className={`text-[10px] font-bold tabular-nums ${accent ? 'text-primary' : 'text-[var(--text-primary)]'}`}>
        {fmtDb(value)}
      </span>
      <input
        type="range"
        id={id}
        min={EQ_GAIN_MIN}
        max={EQ_GAIN_MAX}
        step={1}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="cursor-pointer accent-primary"
        style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 18, height: 110 } as React.CSSProperties}
      />
      <span className={`text-[9px] font-semibold tabular-nums ${accent ? 'text-primary' : 'text-[var(--text-tertiary)]'}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Master-тумблер */}
      <section className="rounded-2xl shadow-card overflow-hidden ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <SettingRow
          id="audio_equalizer"
          title={t('player.eq.master_title')}
          description={t('player.eq.master_desc')}
          icon={<EqualizerIcon className="w-5 h-5" />}
          iconColor="blue"
        />
      </section>

      <div
        aria-disabled={!enabled}
        className={`space-y-5 transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none grayscale'}`}
      >
        {/* Пресеты */}
        <SettingsSection title={t('player.eq.presets')}>
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {BUILTIN_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p)}
                className={`text-[11px] font-semibold leading-none px-2.5 py-1.5 rounded-lg border transition-colors ${
                  presetId === p.id
                    ? 'bg-primary border-transparent text-white'
                    : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                {p.name}
              </button>
            ))}
            {custom.map((p) => (
              <span
                key={p.id}
                className={`relative inline-flex items-center text-[11px] font-semibold leading-none pl-2.5 pr-6 py-1.5 rounded-lg border transition-colors ${
                  presetId === p.id
                    ? 'bg-primary border-transparent text-white'
                    : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <button type="button" onClick={() => applyPreset(p)} className="cursor-pointer">{p.name}</button>
                <button
                  type="button"
                  onClick={() => deleteCustom(p.id)}
                  title={t('player.eq.delete_preset')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-[11px] leading-none"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </SettingsSection>

        {/* Полосы */}
        <SettingsSection title={t('player.eq.frequencies')}>
          <div className="flex items-stretch gap-1 px-3 py-4">
            <div className="pr-2 mr-1 border-r border-[var(--border-color)]">
              <VerticalSlider id="eq_preamp" label="Pre" value={preamp} accent onChange={onPreamp} />
            </div>
            {EQ_FREQUENCIES.map((hz, i) => (
              <VerticalSlider
                key={hz}
                id={`eq_band_${i}`}
                label={bandLabel(hz)}
                value={bands[i] ?? 0}
                onChange={(v) => onBand(i, v)}
              />
            ))}
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={() => applyPreset(BUILTIN_PRESETS[0])}
              className="flex-1 text-xs font-semibold py-2 rounded-lg border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              {t('player.eq.reset')}
            </button>
            <button
              type="button"
              onClick={saveCustom}
              className="flex-1 text-xs font-semibold py-2 rounded-lg bg-primary text-white hover:brightness-105 transition"
            >
              {t('player.eq.save_preset')}
            </button>
          </div>
        </SettingsSection>
      </div>

      <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title={t('player.eq.how_title')} variant="tip">
        {t('player.eq.how_body')}
      </InfoBlock>
    </div>
  );
}
