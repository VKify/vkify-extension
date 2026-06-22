import React from 'react';
import { XIcon } from '../../icons/Icons.js';
import type { TrackedUser } from '@/types/index.js';

/**
 * Строка отслеживаемого пользователя (аватар + имя + ID + удалить). Идентична
 * в секциях «Активность» и «Профили» с точностью до цвета фолбэк-аватара.
 * (Онлайн-мониторинг использует более богатую карточку TrackedUserCard.)
 */
export default function TrackedUserRow({
  user,
  onRemove,
  tone = 'primary',
}: {
  user: TrackedUser;
  onRemove: (id: string) => void;
  tone?: 'primary' | 'purple';
}) {
  const avatarBg = tone === 'purple' ? 'bg-purple-500/10' : 'bg-primary/10';
  const avatarFg = tone === 'purple' ? 'text-purple-500' : 'text-primary';

  return (
    <div className="flex items-center justify-between p-2 bg-[var(--bg-secondary)] rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        {user.photo ? (
          <img src={user.photo} alt={user.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className={`w-10 h-10 rounded-full ${avatarBg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-sm font-medium ${avatarFg}`}>{user.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-[var(--text-primary)] truncate">{user.name}</div>
          <div className="text-xs text-[var(--text-tertiary)]">ID: {user.id}</div>
        </div>
      </div>
      <button
        onClick={() => onRemove(user.id)}
        className="p-1.5 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-lg transition-colors"
      >
        <XIcon className="w-4 h-4" />
      </button>
    </div>
  );
}
