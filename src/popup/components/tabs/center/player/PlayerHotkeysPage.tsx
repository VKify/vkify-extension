import React, { useCallback } from 'react';
import SettingRow from '@/popup/components/ui/SettingRow.js';
import SettingsSection, { SectionDivider } from '@/popup/components/ui/SettingsSection.js';
import HotkeyPicker from '@/popup/components/ui/HotkeyPicker.js';
import InfoBlock from '@/popup/components/ui/InfoBlock.js';
import { useSettings } from '@/popup/context/SettingsContext.js';
import {
  MusicIcon, PlayIcon, SkipBackIcon, SkipForwardIcon,
  SeekBackIcon, SeekForwardIcon, SpeedUpIcon, SpeedDownIcon, SpeedResetIcon, InfoIcon,
} from '@/popup/components/icons/Icons.js';
import type { HotkeyCombo } from '@/types/index.js';
import { IS_FIREFOX } from '@/shared/constants/browser.js';
import { openTab } from '@/popup/utils/tabs.js';

/**
 * Подстраница «Плеер → Управление с клавиатуры». Тело отдельной страницы
 * функции (см. PlayerPage + SubpageHost): мастер-тумблер отдельным блоком,
 * хоткеи сгруппированы по смыслу, всё гаснет пока функция выключена.
 */

// Где пользователь назначает «глобальные» (кросс-вкладочные) хоткеи команд:
// механизм один и тот же (manifest commands), но UI разный у движков.
const SHORTCUTS_LOCATION = IS_FIREFOX
  ? 'about:addons → ⚙️ → «Управление горячими клавишами расширений»'
  : 'chrome://extensions/shortcuts';

const DEFAULT_MEDIA_HOTKEYS = {
  play_pause:    { ctrlKey: false, shiftKey: false, altKey: true, code: 'KeyP',       label: 'Alt+P'       },
  next:          { ctrlKey: false, shiftKey: false, altKey: true, code: 'ArrowRight', label: 'Alt+→'       },
  prev:          { ctrlKey: false, shiftKey: false, altKey: true, code: 'ArrowLeft',  label: 'Alt+←'       },
  seek_forward:  { ctrlKey: false, shiftKey: true,  altKey: true, code: 'ArrowRight', label: 'Alt+Shift+→' },
  seek_backward: { ctrlKey: false, shiftKey: true,  altKey: true, code: 'ArrowLeft',  label: 'Alt+Shift+←' },
  rate_up:       { ctrlKey: false, shiftKey: false, altKey: true, code: 'Equal',      label: 'Alt+='       },
  rate_down:     { ctrlKey: false, shiftKey: false, altKey: true, code: 'Minus',      label: 'Alt+-'       },
  rate_reset:    { ctrlKey: false, shiftKey: false, altKey: true, code: 'Digit0',     label: 'Alt+0'       },
} satisfies Record<string, HotkeyCombo>;

export default function PlayerHotkeysPage(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  const enabled = settings['media_player_hotkeys'] === true;

  const hk = (key: string, def: HotkeyCombo): HotkeyCombo =>
    (settings[key] as HotkeyCombo | undefined) ?? def;

  const makeHotkeyHandler = useCallback(
    (key: string) => (combo: HotkeyCombo): void => { void saveSetting(key, combo); },
    [saveSetting],
  );

  return (
    <div className="space-y-5">
      {/* Master-тумблер */}
      <section className="rounded-2xl shadow-card overflow-hidden ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <SettingRow
          id="media_player_hotkeys"
          title="Включить хоткеи"
          description="Плеер VK без перехода на вкладку"
          icon={<MusicIcon className="w-5 h-5" />}
          iconColor="pink"
        />
      </section>

      {/* Зависимые настройки — гаснут, пока функция выключена */}
      <div
        aria-disabled={!enabled}
        className={`space-y-5 transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none grayscale'}`}
      >
        <SettingsSection title="Управление треком">
          <HotkeyRow
            label="Пауза / плей"
            icon={<PlayIcon className="w-3.5 h-3.5" />}
            value={hk('media_hotkey_play_pause', DEFAULT_MEDIA_HOTKEYS.play_pause)}
            defaultValue={DEFAULT_MEDIA_HOTKEYS.play_pause}
            onChange={makeHotkeyHandler('media_hotkey_play_pause')}
          />
          <SectionDivider />
          <HotkeyRow
            label="Предыдущий"
            icon={<SkipBackIcon className="w-3.5 h-3.5" />}
            value={hk('media_hotkey_prev', DEFAULT_MEDIA_HOTKEYS.prev)}
            defaultValue={DEFAULT_MEDIA_HOTKEYS.prev}
            onChange={makeHotkeyHandler('media_hotkey_prev')}
          />
          <SectionDivider />
          <HotkeyRow
            label="Следующий"
            icon={<SkipForwardIcon className="w-3.5 h-3.5" />}
            value={hk('media_hotkey_next', DEFAULT_MEDIA_HOTKEYS.next)}
            defaultValue={DEFAULT_MEDIA_HOTKEYS.next}
            onChange={makeHotkeyHandler('media_hotkey_next')}
          />
          <SectionDivider />
          <HotkeyRow
            label="Перемотка назад"
            icon={<SeekBackIcon className="w-3.5 h-3.5" />}
            value={hk('media_hotkey_seek_backward', DEFAULT_MEDIA_HOTKEYS.seek_backward)}
            defaultValue={DEFAULT_MEDIA_HOTKEYS.seek_backward}
            onChange={makeHotkeyHandler('media_hotkey_seek_backward')}
          />
          <SectionDivider />
          <HotkeyRow
            label="Перемотка вперёд"
            icon={<SeekForwardIcon className="w-3.5 h-3.5" />}
            value={hk('media_hotkey_seek_forward', DEFAULT_MEDIA_HOTKEYS.seek_forward)}
            defaultValue={DEFAULT_MEDIA_HOTKEYS.seek_forward}
            onChange={makeHotkeyHandler('media_hotkey_seek_forward')}
          />
        </SettingsSection>

        <SettingsSection title="Скорость">
          <HotkeyRow
            label="Быстрее (+0.25×)"
            icon={<SpeedUpIcon className="w-3.5 h-3.5" />}
            value={hk('media_hotkey_rate_up', DEFAULT_MEDIA_HOTKEYS.rate_up)}
            defaultValue={DEFAULT_MEDIA_HOTKEYS.rate_up}
            onChange={makeHotkeyHandler('media_hotkey_rate_up')}
          />
          <SectionDivider />
          <HotkeyRow
            label="Медленнее (−0.25×)"
            icon={<SpeedDownIcon className="w-3.5 h-3.5" />}
            value={hk('media_hotkey_rate_down', DEFAULT_MEDIA_HOTKEYS.rate_down)}
            defaultValue={DEFAULT_MEDIA_HOTKEYS.rate_down}
            onChange={makeHotkeyHandler('media_hotkey_rate_down')}
          />
          <SectionDivider />
          <HotkeyRow
            label="Сбросить до 1×"
            icon={<SpeedResetIcon className="w-3.5 h-3.5" />}
            value={hk('media_hotkey_rate_reset', DEFAULT_MEDIA_HOTKEYS.rate_reset)}
            defaultValue={DEFAULT_MEDIA_HOTKEYS.rate_reset}
            onChange={makeHotkeyHandler('media_hotkey_rate_reset')}
          />
        </SettingsSection>

        <SettingsSection title="С любой вкладки">
          <div className="px-4 pb-4 pt-1 space-y-3">
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Хоткеи выше — локальные: работают только на вкладке VK. Чтобы
              переключать треки из любой вкладки, назначьте глобальные хоткеи в
              настройках браузера (свободны, например, мультимедиа-клавиши и
              <code className="mx-1 px-1 py-0.5 bg-[var(--bg-secondary)] rounded text-[10px]">Alt+Shift+→/←</code>).
            </p>
            {!IS_FIREFOX ? (
              <button
                onClick={() => openTab('chrome://extensions/shortcuts')}
                className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                Открыть хоткеи браузера
              </button>
            ) : (
              <p className="text-[11px] text-[var(--text-tertiary)]">{SHORTCUTS_LOCATION}</p>
            )}
          </div>
        </SettingsSection>
      </div>

      <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title="Как это работает" variant="tip">
        Локальные хоткеи срабатывают только на активной вкладке VK. Скорость
        меняется от 0.25× до 3× с шагом 0.25.
      </InfoBlock>
    </div>
  );
}

interface HotkeyRowProps {
  label: string;
  icon: React.ReactNode;
  value: HotkeyCombo;
  defaultValue: HotkeyCombo;
  onChange: (combo: HotkeyCombo) => void;
}

function HotkeyRow({ label, icon, value, defaultValue, onChange }: HotkeyRowProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm text-[var(--text-primary)] min-w-0">
        <span className="text-[var(--text-tertiary)] flex-shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <HotkeyPicker value={value} defaultValue={defaultValue} onChange={onChange} />
    </div>
  );
}
