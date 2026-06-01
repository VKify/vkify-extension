import { installExtApi } from '../shared/ext-api.js';
import { SpyTracker } from './services/spy-tracker.js';
import { ProfileTracker } from './services/profile-tracker.js';
import { AlarmManager } from './services/alarm-manager.js';
import { NotificationService } from './services/notification-service.js';
import { VKTokenManager } from './utils/vk-api.js';
import { MessageHandler } from './handlers/message-handler.js';
import { TabsHelper } from './utils/tabs.js';
import type { ExtensionSettings, ExtensionMessage } from '../types/index.js';
import { DEFAULT_SETTINGS } from '../shared/constants/defaults.js';
import { StorageKey } from '../shared/constants/storage-keys.js';
import { siteUrl } from '../shared/constants/site.js';

installExtApi(); // cross-browser chrome/browser normalisation — before any chrome.* call

console.log('[VKify] Service worker started');

// Единственное место, где собираются зависимости.
// Порядок создания:
//   1. tokenManager  — нет зависимостей
//   2. notificationService — нет зависимостей
//   3. spyTracker    — зависит от notificationService + tokenManager
//   4. alarmManager  — нет зависимостей
//   5. messageHandler — зависит от всех выше

const tokenManager       = new VKTokenManager();
const notificationService = new NotificationService();
const spyTracker         = new SpyTracker(notificationService, tokenManager);
const profileTracker     = new ProfileTracker(notificationService, tokenManager);
const alarmManager       = new AlarmManager();
const messageHandler     = new MessageHandler(spyTracker, profileTracker, alarmManager, notificationService, tokenManager);


async function initialize(): Promise<void> {
  await spyTracker.loadState();
  await profileTracker.loadState();
  await alarmManager.setupStorageMonitor();

  const settings = await chrome.storage.local.get(null) as Partial<ExtensionSettings>;

  // Заполняем недостающие ключи дефолтами. Срабатывает только для тех ключей,
  // которые НИКОГДА не были выставлены (undefined в storage) — добавление
  // новой фичи в DEFAULT_SETTINGS автоматически доезжает до существующих
  // пользователей после обновления, не перетирая их явные настройки.
  const missing: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in settings)) {
      missing[key] = value;
      (settings as Record<string, unknown>)[key] = value;
    }
  }
  if (Object.keys(missing).length > 0) {
    await chrome.storage.local.set(missing);
    console.log('[VKify] Backfilled missing defaults:', Object.keys(missing));
  }

  if (settings.online_tracked_users === undefined && (settings.spy_tracked_users?.length ?? 0) > 0) {
    settings.online_tracked_users = settings.spy_tracked_users;
    await chrome.storage.local.set({ [StorageKey.ONLINE_TRACKED_USERS]: settings.spy_tracked_users });
    console.log('[VKify] Migrated', settings.spy_tracked_users!.length, 'users → online_tracked_users');
  }

  if (settings.spy_online && (settings.online_tracked_users?.length ?? 0) > 0) {
    await spyTracker.start(settings);
  }

  if (settings.profile_spy && (settings.profile_tracked_users?.length ?? 0) > 0) {
    await profileTracker.start(settings);
  }
}


chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[VKify] onInstalled:', details.reason);

  if (details.reason === 'install') {
    await handleFirstInstall();
    chrome.tabs.create({ url: siteUrl(`/welcome?version=${chrome.runtime.getManifest().version}`) });
  }

  if (details.reason === 'update' && details.previousVersion) {
    await handleUpdate(details.previousVersion, chrome.runtime.getManifest().version);
  }

  await initialize();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[VKify] Browser started');

  const data = await chrome.storage.local.get(StorageKey.PENDING_UPDATE_VERSION);
  if (data[StorageKey.PENDING_UPDATE_VERSION]) {
    chrome.tabs.create({ url: siteUrl(`/changelog/${data[StorageKey.PENDING_UPDATE_VERSION]}`) });
    await chrome.storage.local.remove(StorageKey.PENDING_UPDATE_VERSION);
  }

  await initialize();
});

if (chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(async () => {
    console.log('[VKify] Service worker suspending...');
    await spyTracker.stop();
    await profileTracker.stop();
  });
}

chrome.runtime.setUninstallURL(siteUrl('/uninstall'));


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  let url: URL;
  try {
    url = new URL(tab.url);
  } catch {
    return;
  }

  if (!url.hostname.endsWith('vk.com')) return;

  const encoded = url.searchParams.get('vkify_theme');
  if (!encoded) return;

  console.log('[VKify] Detected vkify_theme param in URL, applying theme...');

  const result = await messageHandler.handleApplySharedTheme(encoded);

  if (result.success) {
    await notificationService.show(
      `theme-applied-${Date.now()}`,
      'VKify — тема применена ✨',
      `Применено настроек: ${result.applied.length}`,
    );
    console.log('[VKify] Theme applied from URL:', result.applied);
  } else {
    console.warn('[VKify] Failed to apply theme from URL:', result.error);
  }

  // Убираем vkify_theme из URL без перезагрузки страницы.
  // history.replaceState в контентном скрипте — чище, чем chrome.tabs.update,
  // потому что не вызывает двойного рефреша: VK уже загружен, тема уже в storage.
  url.searchParams.delete('vkify_theme');
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'CLEAN_URL', url: url.toString() });
  } catch {
    // Контентный скрипт не отвечает (напр., не успел инициализироваться) —
    // откатываемся к навигации: страница перезагрузится с чистым URL.
    try {
      await chrome.tabs.update(tabId, { url: url.toString() });
    } catch {
      // Вкладка могла быть закрыта
    }
  }
});


async function handleFirstInstall(): Promise<void> {
  console.log('[VKify] First install');
  await chrome.storage.local.set(DEFAULT_SETTINGS);
}

async function handleUpdate(previousVersion: string, currentVersion: string): Promise<void> {
  console.log(`[VKify] Updated from ${previousVersion} to ${currentVersion}`);
  await chrome.storage.local.set({ [StorageKey.PENDING_UPDATE_VERSION]: currentVersion });
}


chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;

  const spyKeys = ['spy_online', 'spy_online_interval', 'online_tracked_users'];
  if (spyKeys.some(key => changes[key])) {
    console.log('[VKify] Online spy settings changed');
    await spyTracker.handleSettingsChange();
  }

  // Profile-spy settings — отдельный наблюдатель, не пересекается с online/activity.
  const profileKeys = ['profile_spy', 'profile_spy_interval', 'profile_tracked_users'];
  if (profileKeys.some(key => changes[key])) {
    console.log('[VKify] Profile spy settings changed');
    await profileTracker.handleSettingsChange();
  }
});


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  messageHandler
    .handle(message as ExtensionMessage, sender)
    .then(sendResponse)
    .catch((err: unknown) => {
      if (!messageHandler.isExpectedError(err)) {
        console.error('[VKify] Message handler error:', err);
      }
      const e = err as Error & { code?: string };
      sendResponse({ success: false, error: e.message, code: e.code });
    });

  return true;
});


chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('[VKify] Alarm fired:', alarm.name);
  await alarmManager.handleAlarm(alarm.name, spyTracker, profileTracker);
});


// ── Global media hotkeys ────────────────────────────────────────────────────
//
// Хоткеи плеера, объявленные в manifest.json → commands, доставляются сюда
// независимо от того, на какой вкладке сейчас пользователь. Это решает баг,
// когда in-page keydown-слушатель работал только на vk.com и не отзывался,
// если активна другая вкладка (mail.ru, GitHub и т.п.).
//
// Команда транслируется во все открытые VK-вкладки; нужная (та, где играет
// аудио) её обработает через инжектированный player-control.js, остальные —
// no-op. См. content/services/message-service.ts → PLAYER_ACTION.
if (chrome.commands?.onCommand) {
  const COMMAND_TO_ACTION: Record<string, string> = {
    media_play_pause:    'play_pause',
    media_next:          'next',
    media_prev:          'prev',
    media_seek_forward:  'seek_forward',
    media_seek_backward: 'seek_backward',
    media_rate_up:       'rate_up',
    media_rate_down:     'rate_down',
    media_rate_reset:    'rate_reset',
  };

  chrome.commands.onCommand.addListener(async (command) => {
    const action = COMMAND_TO_ACTION[command];
    if (!action) return;
    await TabsHelper.notifyAllVKTabs({ type: 'PLAYER_ACTION', action });
  });
}


self.addEventListener('error', (event) => {
  console.error('[VKify] SW error:', (event as ErrorEvent).error);
});

self.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  if (reason && messageHandler.isExpectedError(reason)) {
    event.preventDefault();
    const msg = (reason as Error).message ?? (reason as { code?: string }).code;
    console.log('[VKify] Handled rejection:', msg);
    return;
  }
  console.error('[VKify] Unhandled rejection:', reason);
});

console.log('[VKify] Service worker ready');