import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useVKifyStore } from '../store/index.js';
import Modal from './ui/Modal.js';
import { WarningIcon } from './icons/Icons.js';
import {
  CONFLICTING_IDS, isFeatureOn, offValueFor, pendingConflicts, featureTitle,
} from '../utils/conflicts.js';
import type { Settings } from '../store/slices/settingsSlice.js';

/** Обнаруженный конфликт, ожидающий решения пользователя. */
interface PendingDecision {
  /** id фичи, которую только что включили. */
  readonly enabledId: string;
  /** id уже включённой фичи, с которой возник конфликт. */
  readonly otherId: string;
  readonly reason: string;
}

/**
 * Вотчер конфликтов фич: следит за настройками (Zustand-store) и при включении
 * фичи, конфликтующей с уже включённой, показывает модалку с выбором:
 * «Отключить [другую] и оставить новую» либо «Отменить» (откатить включение).
 * Пары конфликтов — shared/constants/feature-conflicts.ts (тот же источник, по
 * которому content-скрипт эмитит feature:conflict и пишет console.warn).
 *
 * Один центральный вотчер вместо правок в каждом тумблере: любой путь
 * включения (Toggle, поиск, импорт, пресет) проходит через store → сюда.
 * Настройка успевает записаться ДО решения — «Отменить» возвращает её в
 * выключенное состояние (визуально мгновенно, VK и мигнуть не успевает).
 */
export default function ConflictWatcher(): React.ReactElement | null {
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const prev = useRef<Settings | null>(null);
  const [decision, setDecision] = useState<PendingDecision | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = settings;
    if (!before) return; // первый снимок после загрузки — ничего не «включали»

    for (const id of CONFLICTING_IDS) {
      if (!isFeatureOn(settings[id]) || isFeatureOn(before[id])) continue; // не переход выкл→вкл

      const conflict = pendingConflicts(id, settings)[0];
      if (conflict) {
        // Пока открыта модалка, новые конфликты не наслаиваем.
        setDecision((cur) => cur ?? { enabledId: id, otherId: conflict.with, reason: conflict.reason });
        return;
      }
    }
  }, [settings]);

  const keepNew = useCallback((): void => {
    if (!decision) return;
    // Отключаем «другую сторону»; только что включённая фича остаётся.
    void saveSetting(decision.otherId, offValueFor(settings[decision.otherId]));
    setDecision(null);
  }, [decision, saveSetting, settings]);

  const cancel = useCallback((): void => {
    if (!decision) return;
    // Откатываем только что включённую фичу.
    void saveSetting(decision.enabledId, offValueFor(settings[decision.enabledId]));
    setDecision(null);
  }, [decision, saveSetting, settings]);

  if (!decision) return null;

  const newTitle = featureTitle(decision.enabledId);
  const otherTitle = featureTitle(decision.otherId);

  return (
    <Modal
      onClose={cancel}
      title="Конфликт функций"
      ariaLabel="Конфликт функций"
      footer={
        <>
          <button
            onClick={keepNew}
            className="flex-1 px-3 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-hover transition-all active:scale-95"
          >
            Отключить «{otherTitle}»
          </button>
          <button
            onClick={cancel}
            className="flex-1 px-3 py-2 text-sm font-medium bg-[var(--bg-secondary)] text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-tertiary)] transition-all active:scale-95"
          >
            Отменить
          </button>
        </>
      }
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
            <WarningIcon className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-sm text-[var(--text-primary)] leading-relaxed">
            Функция <b>«{newTitle}»</b> конфликтует с включённой <b>«{otherTitle}»</b>.
          </p>
        </div>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          Причина: {decision.reason}.
        </p>
        <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
          «Отключить» выключит «{otherTitle}» и оставит «{newTitle}». «Отменить» вернёт всё как было.
        </p>
      </div>
    </Modal>
  );
}
