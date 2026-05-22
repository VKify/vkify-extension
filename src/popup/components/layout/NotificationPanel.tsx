import React from 'react';
import { BellIcon, XIcon } from '../icons/Icons.js';
import type { AppNotification } from '../../hooks/core/useHeaderNotifications.js';

interface NotificationPanelProps {
  notifications: AppNotification[];
  onClose: () => void;
}

export default function NotificationPanel({ notifications, onClose }: NotificationPanelProps) {
  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-primary)] rounded-xl shadow-2xl border border-[var(--border-color)] z-[100] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Уведомления</span>
        <button
          onClick={onClose}
          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <BellIcon className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2 opacity-50" />
          <p className="text-sm text-[var(--text-tertiary)]">Нет уведомлений</p>
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          {notifications.map(notif => (
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
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}