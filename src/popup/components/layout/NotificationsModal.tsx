import React from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.js';
import { BellIcon, ExternalLinkIcon } from '../icons/Icons.js';
import type { AppNotification } from '../../hooks/core/useHeaderNotifications.js';

interface NotificationsModalProps {
  notifications: AppNotification[];
  onClose: () => void;
}

/**
 * Уведомления расширения в едином модальном окне (ui/Modal) — то же
 * оформление, что у палитры поиска Ctrl+K: затемнение с блюром, карточка
 * сверху, закрытие по Escape и клику вне. Раньше было кастомным dropdown'ом
 * под колоколом.
 */
export default function NotificationsModal({ notifications, onClose }: NotificationsModalProps) {
  const { t } = useTranslation('modals');
  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          {t('notifs.title')}
          {notifications.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold text-white bg-error rounded-full leading-none">
              {notifications.length}
            </span>
          )}
        </span>
      }
      onClose={onClose}
      align="top"
      maxWidthClass="max-w-[420px]"
      ariaLabel={t('notifs.aria')}
    >
      {notifications.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <BellIcon className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[var(--text-tertiary)]">{t('notifs.empty')}</p>
        </div>
      ) : (
        notifications.map(notif => (
          <div
            key={notif.id}
            className={`px-4 py-3 border-b border-[var(--border-color)] last:border-b-0 ${
              notif.type === 'warning' ? 'bg-warning/5' : ''
            }`}
          >
            <div className="flex gap-3">
              <span className="text-xl flex-shrink-0">{notif.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">{notif.title}</div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">{notif.message}</div>
                {notif.action && (
                  <a
                    href={notif.action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={onClose}
                    className="inline-flex items-center gap-1 mt-2 px-3 py-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                  >
                    {notif.action.label}
                    <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </Modal>
  );
}
