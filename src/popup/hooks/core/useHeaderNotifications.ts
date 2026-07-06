import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { countVKTabs } from '../../utils/tabs.js';

export interface NotificationAction {
  label: string;
  url: string;
}

export interface AppNotification {
  id: string;
  type: 'warning' | 'info';
  icon: string;
  title: string;
  message: string;
  action?: NotificationAction;
}

interface Params {
  settings: Record<string, unknown>;
  hasToken: boolean;
  needsVKTab: boolean;
}

function buildNotifications(
  settings: Record<string, unknown>,
  hasToken: boolean,
  needsVKTab: boolean,
  hasFriendsPage: boolean,
  t: TFunction,
): AppNotification[] {
  const list: AppNotification[] = [];
  // Заголовок/текст берём из каталога по id уведомления (modals:notifs.items.<id>).
  const item = (id: string, type: 'warning' | 'info', icon: string, action?: NotificationAction): AppNotification => ({
    id, type, icon,
    title: t(`notifs.items.${id}.title`),
    message: t(`notifs.items.${id}.message`),
    ...(action ? { action } : {}),
  });
  const openVK = (url: string): NotificationAction => ({ label: t('notifs.open_vk'), url });

  // Two independent lists: online monitor vs activity (messages) spy.
  const hasOnlineTrackedUsers =
    ((settings['online_tracked_users'] as unknown[] | undefined)?.length ?? 0) > 0;
  const hasActivityTrackedUsers =
    ((settings['spy_tracked_users'] as unknown[] | undefined)?.length ?? 0) > 0;

  if (settings['spy_online'] && needsVKTab) {
    list.push(item('spy_no_vk_tab', 'warning', '👁️', openVK('https://vk.com')));
  }

  if (settings['spy_online'] && !hasToken && !needsVKTab) {
    list.push(item('spy_no_token', 'warning', '🔑', openVK('https://vk.com')));
  }

  if (settings['spy_online'] && !hasOnlineTrackedUsers) {
    list.push(item('spy_no_users', 'info', '👤'));
  }

  if (settings['spy_enabled'] && needsVKTab) {
    list.push(item('activity_spy_no_vk_tab', 'warning', '⌨️', openVK('https://vk.com')));
  }

  if (settings['spy_enabled'] && settings['spy_mode'] === 'selected' && !hasActivityTrackedUsers) {
    list.push(item('activity_spy_no_users', 'info', '👥'));
  }

  if (settings['auto_add_friends'] && needsVKTab) {
    list.push(item('auto_add_no_vk_tab', 'warning', '👥', openVK('https://vk.com/friends?act=find')));
  } else if (settings['auto_add_friends'] && !hasFriendsPage && !needsVKTab) {
    list.push(item('auto_add_wrong_page', 'warning', '📄', {
      label: t('notifs.open_page'), url: 'https://vk.com/friends?act=find',
    }));
  }

  return list;
}

const FRIENDS_PAGE_POLL_MS = 2000;

export function useHeaderNotifications({ settings, hasToken, needsVKTab }: Params) {
  const { t } = useTranslation('modals');
  const [hasFriendsPage, setHasFriendsPage] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const check = async (): Promise<void> => {
      try {
        setHasFriendsPage(await countVKTabs('*://*.vk.com/friends?act=find*') > 0);
      } catch { /* ignore permission errors */ }
    };

    void check();
    const id = setInterval(() => { void check(); }, FRIENDS_PAGE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setNotifications(
      buildNotifications(settings, hasToken, needsVKTab, hasFriendsPage, t)
    );
  }, [
    settings['spy_online'],      // eslint-disable-line react-hooks/exhaustive-deps
    settings['online_tracked_users'],
    settings['spy_tracked_users'],
    settings['spy_enabled'],
    settings['spy_mode'],
    settings['auto_add_friends'],
    hasToken,
    needsVKTab,
    hasFriendsPage,
    t,
  ]);

  return notifications;
}