import { useState, useEffect } from 'react';

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
): AppNotification[] {
  const list: AppNotification[] = [];
  // Two independent lists: online monitor vs activity (messages) spy.
  const hasOnlineTrackedUsers =
    ((settings['online_tracked_users'] as unknown[] | undefined)?.length ?? 0) > 0;
  const hasActivityTrackedUsers =
    ((settings['spy_tracked_users'] as unknown[] | undefined)?.length ?? 0) > 0;

  if (settings['spy_online'] && needsVKTab) {
    list.push({
      id: 'spy_no_vk_tab', type: 'warning', icon: '👁️',
      title: 'Онлайн-слежка приостановлена',
      message: 'Откройте вкладку VK для продолжения отслеживания',
      action: { label: 'Открыть VK', url: 'https://vk.com' },
    });
  }

  if (settings['spy_online'] && !hasToken && !needsVKTab) {
    list.push({
      id: 'spy_no_token', type: 'warning', icon: '🔑',
      title: 'Требуется авторизация',
      message: 'Зайдите в VK для получения доступа к API',
      action: { label: 'Открыть VK', url: 'https://vk.com' },
    });
  }

  if (settings['spy_online'] && !hasOnlineTrackedUsers) {
    list.push({
      id: 'spy_no_users', type: 'info', icon: '👤',
      title: 'Добавьте пользователей',
      message: 'Онлайн-слежка включена, но список отслеживаемых пуст',
    });
  }

  if (settings['spy_enabled'] && needsVKTab) {
    list.push({
      id: 'activity_spy_no_vk_tab', type: 'warning', icon: '⌨️',
      title: 'Слежка за действиями приостановлена',
      message: 'Откройте вкладку VK для отслеживания активности',
      action: { label: 'Открыть VK', url: 'https://vk.com' },
    });
  }

  if (settings['spy_enabled'] && settings['spy_mode'] === 'selected' && !hasActivityTrackedUsers) {
    list.push({
      id: 'activity_spy_no_users', type: 'info', icon: '👥',
      title: 'Добавьте пользователей',
      message: 'Слежка за действиями включена, но список отслеживаемых пуст',
    });
  }

  if (settings['auto_add_friends'] && needsVKTab) {
    list.push({
      id: 'auto_add_no_vk_tab', type: 'warning', icon: '👥',
      title: 'Авто-добавление приостановлено',
      message: 'Откройте VK для продолжения',
      action: { label: 'Открыть VK', url: 'https://vk.com/friends?act=find' },
    });
  } else if (settings['auto_add_friends'] && !hasFriendsPage && !needsVKTab) {
    list.push({
      id: 'auto_add_wrong_page', type: 'warning', icon: '📄',
      title: 'Откройте страницу поиска друзей',
      message: 'Авто-добавление работает только на vk.com/friends?act=find',
      action: { label: 'Открыть страницу', url: 'https://vk.com/friends?act=find' },
    });
  }

  return list;
}

const FRIENDS_PAGE_POLL_MS = 2000;

export function useHeaderNotifications({ settings, hasToken, needsVKTab }: Params) {
  const [hasFriendsPage, setHasFriendsPage] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const check = async (): Promise<void> => {
      try {
        const tabs = await chrome.tabs.query({ url: '*://*.vk.com/friends?act=find*' });
        setHasFriendsPage(tabs.length > 0);
      } catch { /* ignore permission errors */ }
    };

    void check();
    const id = setInterval(() => { void check(); }, FRIENDS_PAGE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setNotifications(
      buildNotifications(settings, hasToken, needsVKTab, hasFriendsPage)
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
  ]);

  return notifications;
}