import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { VKifyLogo, BellIcon, ExternalLinkIcon } from '../icons/Icons.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import { useVKifyStore } from '../../store/index.js';
import { useHeaderNotifications } from '../../hooks/core/useHeaderNotifications.js';
import NotificationsModal from './NotificationsModal.js';
import QuickActions from './QuickActions.js';

interface HeaderProps {
  onOpenSearch: () => void;
}

export default function Header({ onOpenSearch }: HeaderProps) {
  const { t } = useTranslation('common');
  const { hasToken, currentUser, loading, needsVKTab, isReady } = useVKApi();
  const settings = useVKifyStore((s) => s.settings);
  const notifications = useHeaderNotifications({ settings, hasToken, needsVKTab });

  const [showNotifications, setShowNotifications] = useState(false);

  const showUser = isReady && currentUser;
  const showSkeleton = loading && !currentUser;
  const showNeedsVKTab = needsVKTab && !loading;
  const hasNotifications = notifications.length > 0;

  return (
    <header className="relative z-50 shadow-lg shadow-primary/10">
      <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary-strong overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg shadow-black/10">
              <VKifyLogo className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">VKify</h1>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold text-white/80 bg-white/20 rounded-md">
                  v{chrome.runtime.getManifest().version}
                </span>
              </div>
              <span className="text-xs text-white/70">{t('app.tagline')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <QuickActions onOpenSearch={onOpenSearch} variant="header" />

            {/* Вертикальный разделитель между группой быстрых действий и
                колоколом/блоком пользователя — визуально режет шапку на
                «инструменты» слева и «статус» справа. */}
            <div className="h-8 w-px bg-white/25 mx-1" aria-hidden="true" />

            <button
              onClick={() => setShowNotifications(true)}
              className={`
                relative h-12 px-3 rounded-xl flex items-center justify-center transition-all backdrop-blur border border-white/20 shadow-lg shadow-black/10
                ${hasNotifications ? 'bg-white/20 hover:bg-white/30' : 'bg-white/15 hover:bg-white/20'}
              `}
            >
              <BellIcon className="w-5 h-5 text-white" />
              {hasNotifications && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationsModal
                notifications={notifications}
                onClose={() => setShowNotifications(false)}
              />
            )}

            {showUser ? (
              <div className="flex items-center gap-2.5 px-3 py-2 bg-white/15 backdrop-blur rounded-xl border border-white/20 shadow-lg shadow-black/10">
                <img
                  src={(currentUser!.photo100 ?? currentUser!.photo50) ?? ''}
                  alt={currentUser!.firstName}
                  className="w-8 h-8 rounded-lg object-cover ring-2 ring-white/30"
                />
                <div>
                  <div className="text-sm font-semibold text-white leading-tight">{currentUser!.firstName}</div>
                  <div className="text-xs text-white/60 leading-tight">{currentUser!.lastName}</div>
                </div>
                <div className="relative w-2.5 h-2.5 ml-1" title={t('header.vk_connected')}>
                  <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                  <span className="absolute inset-0 rounded-full bg-green-400" />
                </div>
              </div>
            ) : showSkeleton ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-white/15 backdrop-blur rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-white/20 animate-pulse" />
                <div className="hidden sm:block space-y-1.5">
                  <div className="w-20 h-3 bg-white/20 rounded animate-pulse" />
                  <div className="w-16 h-2.5 bg-white/20 rounded animate-pulse" />
                </div>
              </div>
            ) : showNeedsVKTab ? (
              <a
                href="https://vk.ru"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-white/15 backdrop-blur rounded-xl border border-white/20 hover:bg-white/25 transition-colors"
                title={t('header.open_vk_hint')}
              >
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <ExternalLinkIcon className="w-4 h-4 text-white/70" />
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-medium text-white/90 leading-tight">{t('header.open_vk')}</div>
                  <div className="text-xs text-white/50 leading-tight">{t('header.open_vk_desc')}</div>
                </div>
              </a>
            ) : (
              <div className="relative w-3 h-3" title={t('header.ext_active')}>
                <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                <span className="absolute inset-0 rounded-full bg-green-400" />
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
