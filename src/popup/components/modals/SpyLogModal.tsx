import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.js';

/** Нормализованная запись лога для отображения (любой из трёх режимов слежки). */
export interface SpyLogDisplayEntry {
  icon: string;
  userName: string;
  photo50?: string;
  /** Основная строка: действие (активность/онлайн) или описание (профили). */
  line: string;
  /** Доп. цитата под строкой (текст сообщения в активности). */
  quote?: string;
  timestamp: number;
}

interface SpyLogModalProps {
  entries: SpyLogDisplayEntry[];
  onClear: () => void | Promise<void>;
  onClose: () => void;
  /** Если передан — показывается кнопка «Экспорт». */
  onExport?: () => void;
  title?: string;
  emptyText?: string;
  /** Цвет фолбэк-аватара без фото. */
  tone?: 'primary' | 'purple';
}

export default function SpyLogModal({
  entries,
  onClear,
  onClose,
  onExport,
  title,
  emptyText,
  tone = 'primary',
}: SpyLogModalProps) {
  const { t } = useTranslation('modals');
  const displayTitle = title ?? t('spy_log.title_default');
  const displayEmpty = emptyText ?? t('spy_log.empty_default');
  const avatarBg = tone === 'purple' ? 'bg-purple-500/10' : 'bg-primary/10';
  const avatarFg = tone === 'purple' ? 'text-purple-500' : 'text-primary';

  return (
    <Modal
      title={displayTitle}
      ariaLabel={displayTitle}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={() => void onClear()}
            disabled={entries.length === 0}
            className="flex-1 py-2.5 text-sm font-medium text-error bg-error/10 hover:bg-error/20 rounded-xl transition-colors disabled:opacity-50"
          >
            {t('clear')}
          </button>
          {onExport && (
            <button
              onClick={onExport}
              disabled={entries.length === 0}
              className="py-2.5 px-4 text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors disabled:opacity-50"
            >
              {t('export')}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
          >
            {t('close')}
          </button>
        </>
      }
    >
      <div className="p-4">
        {entries.length === 0 ? (
          <div className="text-center py-8 text-sm text-[var(--text-tertiary)]">
            {displayEmpty}
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice().reverse().map((entry, index) => (
                <div key={index} className="p-3 bg-[var(--bg-secondary)] rounded-xl">
                  <div className="flex items-start gap-3">
                    {entry.photo50 ? (
                      <img
                        src={entry.photo50}
                        alt={entry.userName}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center flex-shrink-0`}>
                        <span className={`text-sm font-medium ${avatarFg}`}>
                          {entry.userName?.charAt(0)?.toUpperCase() ?? '?'}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{entry.icon}</span>
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {entry.userName}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-0.5">{entry.line}</div>
                      {entry.quote && (
                        <div className="text-xs text-[var(--text-tertiary)] mt-1.5 p-2 bg-[var(--bg-tertiary)] rounded-lg italic line-clamp-2">
                          &ldquo;{entry.quote}&rdquo;
                        </div>
                      )}
                      <div className="text-xs text-[var(--text-tertiary)] mt-1.5 opacity-60">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
    </Modal>
  );
}
