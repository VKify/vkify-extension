import React, { useCallback } from 'react';
import SettingRow from '../../../ui/SettingRow.js';
import HotkeyPicker from '../../../ui/HotkeyPicker.js';
import InfoBlock from '../../../ui/InfoBlock.js';
import { useSettings } from '../../../../context/SettingsContext.js';
import {
  MusicIcon, PlayIcon, SkipBackIcon, SkipForwardIcon,
  SeekBackIcon, SeekForwardIcon, SpeedUpIcon, SpeedDownIcon, SpeedResetIcon,
} from '../../../icons/Icons.js';
import type { HotkeyCombo } from '../../../../../types/index.js';
import { IS_FIREFOX } from '../../../../../shared/constants/browser.js';
import { openTab } from '../../../../utils/tabs.js';

/**
 * Страница «Плеер» хаба «Центр». Управление аудиоплеером ВКонтакте с
 * клавиатуры.
 */

// Где пользователь назначает «глобальные» (кросс-вкладочные) хоткеи команд:
// механизм один и тот же (manifest commands), но UI разный у движков.
const SHORTCUTS_LOCATION = IS_FIREFOX
  ? 'about:addons → ⚙️ → «Управление горячими клавишами расширений»'
  : 'настройках браузера (chrome://extensions/shortcuts)';

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

export default function PlayerPage(): React.ReactElement {
  const { settings, saveSetting } = useSettings();

  const enabled = settings['media_player_hotkeys'] === true;

  const hotkeyPlayPause   = (settings['media_hotkey_play_pause']    as HotkeyCombo | undefined) ?? DEFAULT_MEDIA_HOTKEYS.play_pause;
  const hotkeyNext        = (settings['media_hotkey_next']          as HotkeyCombo | undefined) ?? DEFAULT_MEDIA_HOTKEYS.next;
  const hotkeyPrev        = (settings['media_hotkey_prev']          as HotkeyCombo | undefined) ?? DEFAULT_MEDIA_HOTKEYS.prev;
  const hotkeySeekFwd     = (settings['media_hotkey_seek_forward']  as HotkeyCombo | undefined) ?? DEFAULT_MEDIA_HOTKEYS.seek_forward;
  const hotkeySeekBwd     = (settings['media_hotkey_seek_backward'] as HotkeyCombo | undefined) ?? DEFAULT_MEDIA_HOTKEYS.seek_backward;
  const hotkeyRateUp      = (settings['media_hotkey_rate_up']       as HotkeyCombo | undefined) ?? DEFAULT_MEDIA_HOTKEYS.rate_up;
  const hotkeyRateDown    = (settings['media_hotkey_rate_down']     as HotkeyCombo | undefined) ?? DEFAULT_MEDIA_HOTKEYS.rate_down;
  const hotkeyRateReset   = (settings['media_hotkey_rate_reset']    as HotkeyCombo | undefined) ?? DEFAULT_MEDIA_HOTKEYS.rate_reset;

  const makeHotkeyHandler = useCallback(
    (key: string) => (combo: HotkeyCombo): void => { void saveSetting(key, combo); },
    [saveSetting],
  );

  return (
    <div className="space-y-4">

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          {/* Секция: MusicIcon — управление аудиоплеером */}
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center flex-shrink-0">
            <MusicIcon className="w-5 h-5 text-pink-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Плеер ВКонтакте</h3>
        </div>

        <SettingRow
          id="media_player_hotkeys"
          title="Управление горячими клавишами"
          description="Управляйте аудиоплеером VK с клавиатуры, не переключаясь на вкладку"
          icon={<MusicIcon className="w-5 h-5" />}
          iconColor="pink"
        />

        {enabled && (
          <div className="px-4 pb-4 pt-2 space-y-1 border-t border-[var(--border-color)]">

            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] pt-1 pb-1">
              Управление треком
            </p>
            <HotkeyRow
              label="Воспроизведение / пауза"
              icon={<PlayIcon className="w-3.5 h-3.5" />}
              value={hotkeyPlayPause}
              defaultValue={DEFAULT_MEDIA_HOTKEYS.play_pause}
              onChange={makeHotkeyHandler('media_hotkey_play_pause')}
            />
            <HotkeyRow
              label="Предыдущий трек"
              icon={<SkipBackIcon className="w-3.5 h-3.5" />}
              value={hotkeyPrev}
              defaultValue={DEFAULT_MEDIA_HOTKEYS.prev}
              onChange={makeHotkeyHandler('media_hotkey_prev')}
            />
            <HotkeyRow
              label="Следующий трек"
              icon={<SkipForwardIcon className="w-3.5 h-3.5" />}
              value={hotkeyNext}
              defaultValue={DEFAULT_MEDIA_HOTKEYS.next}
              onChange={makeHotkeyHandler('media_hotkey_next')}
            />
            <HotkeyRow
              label="Перемотка назад"
              icon={<SeekBackIcon className="w-3.5 h-3.5" />}
              value={hotkeySeekBwd}
              defaultValue={DEFAULT_MEDIA_HOTKEYS.seek_backward}
              onChange={makeHotkeyHandler('media_hotkey_seek_backward')}
            />
            <HotkeyRow
              label="Перемотка вперёд"
              icon={<SeekForwardIcon className="w-3.5 h-3.5" />}
              value={hotkeySeekFwd}
              defaultValue={DEFAULT_MEDIA_HOTKEYS.seek_forward}
              onChange={makeHotkeyHandler('media_hotkey_seek_forward')}
            />

            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] pt-3 pb-1">
              Скорость воспроизведения
            </p>
            <HotkeyRow
              label="Ускорить (+0.25×)"
              icon={<SpeedUpIcon className="w-3.5 h-3.5" />}
              value={hotkeyRateUp}
              defaultValue={DEFAULT_MEDIA_HOTKEYS.rate_up}
              onChange={makeHotkeyHandler('media_hotkey_rate_up')}
            />
            <HotkeyRow
              label="Замедлить (−0.25×)"
              icon={<SpeedDownIcon className="w-3.5 h-3.5" />}
              value={hotkeyRateDown}
              defaultValue={DEFAULT_MEDIA_HOTKEYS.rate_down}
              onChange={makeHotkeyHandler('media_hotkey_rate_down')}
            />
            <HotkeyRow
              label="Сбросить до 1×"
              icon={<SpeedResetIcon className="w-3.5 h-3.5" />}
              value={hotkeyRateReset}
              defaultValue={DEFAULT_MEDIA_HOTKEYS.rate_reset}
              onChange={makeHotkeyHandler('media_hotkey_rate_reset')}
            />

            <div className="mt-4 -mx-4 px-4 pt-3 border-t border-[var(--border-color)]">
              <div className="p-3 bg-[var(--bg-secondary)] rounded-xl">
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-base flex-shrink-0">⌨️</span>
                  <div>
                    <div className="text-xs font-semibold text-[var(--text-primary)]">Работа с любой вкладки</div>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
                      Хоткеи выше — <strong>локальные</strong>: срабатывают только когда активна вкладка VK.
                      Чтобы переключать треки с любой вкладки браузера (пока его окно в фокусе — когда
                      браузер свёрнут, шорткаты не ловятся), назначьте <strong>глобальные</strong>{' '}
                      хоткеи в {SHORTCUTS_LOCATION} — мы их объявили, но без предустановленных значений,
                      чтобы не конфликтовать с вашими шорткатами.
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed mb-2 pl-6">
                  Свободные безопасные комбинации:{' '}
                  <code className="px-1 py-0.5 bg-[var(--bg-primary)] rounded text-[10px]">Alt+Shift+→/←/↑/↓</code>,{' '}
                  <code className="px-1 py-0.5 bg-[var(--bg-primary)] rounded text-[10px]">Alt+Shift+0</code>, мультимедиа-клавиши{' '}
                  <code className="px-1 py-0.5 bg-[var(--bg-primary)] rounded text-[10px]">▶/⏸ ⏭ ⏮</code>.
                  <br/>
                  <span className="opacity-70">
                    <code className="px-1 py-0.5 bg-[var(--bg-primary)] rounded text-[10px]">Alt+←/→</code> зарезервированы браузером под навигацию (назад/вперёд).
                  </span>
                </p>
                {/* Firefox запрещает расширениям открывать about:addons из кода,
                    поэтому кнопку показываем только на Chromium (chrome://extensions/shortcuts
                    там открывается). В Firefox путь к назначению указан текстом выше. */}
                {!IS_FIREFOX && (
                  <button
                    onClick={() => openTab('chrome://extensions/shortcuts')}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/90 active:scale-[0.98] transition-all"
                  >
                    Открыть настройки хоткеев браузера
                  </button>
                )}
              </div>
            </div>

          </div>
        )}
      </section>

      <InfoBlock variant="info" icon="🎵" title="Как это работает">
        Локальные хоткеи срабатывают только когда активна вкладка VK. Скорость
        меняется от 0.25× до 3× с шагом 0.25. Для управления с любой вкладки —
        включите тумблер выше и назначьте глобальные хоткеи в {SHORTCUTS_LOCATION}.
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

function HotkeyRow({ label, icon, value, defaultValue, onChange }: HotkeyRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] min-w-0">
        <span className="text-[var(--text-tertiary)] flex-shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <HotkeyPicker value={value} defaultValue={defaultValue} onChange={onChange} />
    </div>
  );
}
