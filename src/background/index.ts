import { installExtApi } from '../shared/ext-api.js';
import { SpyTracker } from './services/spy-tracker.js';
import { ProfileTracker } from './services/profile-tracker.js';
import { AlarmManager } from './services/alarm-manager.js';
import { NotificationService } from './services/notification-service.js';
import { VKTokenManager, callVKApi } from './utils/vk-api.js';
import { MessageRelay, MESSAGE_RELAY_ALARM, MESSAGE_RELAY_KEYS } from './services/message-relay.js';
import { MessageHandler } from './handlers/message-handler.js';
import { AUTO_ADD_ALARM } from '../shared/auto-add-friends.js';
import { GROUP_PARSER_ALARM } from '../shared/group-parser.js';
import { TabsHelper } from './utils/tabs.js';
import type { ExtensionSettings, ExtensionMessage } from '../types/index.js';
import { DEFAULT_SETTINGS } from '../shared/constants/defaults.js';
import { StorageKey } from '../shared/constants/storage-keys.js';
import { CURRENT_SCHEMA_VERSION, SCHEMA_VERSION_KEY } from '../shared/constants/storage.js';
import { migrator } from '../shared/storage/Migrator.js';
import { siteUrl } from '../shared/constants/site.js';
import { installPdfRenderRelay } from './services/pdf-render-relay.js';
import { BackgroundTelegramNotifier, readTelegramSettings, TELEGRAM_SETTING_KEYS } from '../shared/telegram-notifications/index.js';
import type { ResolvedTelegramRecipient } from '../shared/telegram-notifications/recipient.js';
import { messagePhotos } from '../shared/telegram-notifications/photos.js';
import { messageAttachments } from '../shared/telegram-notifications/attachments.js';
import { object } from '../shared/center-tools.js';
import { PersistentTelegramQueue, TELEGRAM_QUEUE_ALARM, TELEGRAM_QUEUE_KEY, type TelegramQueueState } from '../shared/telegram-notifications/queue.js';
import { cacheableApiMessage } from '../shared/telegram-notifications/message-cache.js';

installExtApi(); // cross-browser chrome/browser normalisation — before any chrome.* call

// Импорт ПОСЛЕ installExtApi(): каноничный settings-store трогает chrome.* на
// этапе module-eval (migrator + onChanged), а ext-api нормализует глобальный
// `chrome` (Firefox: browser→chrome) как side-effect своего импорта (строка 1),
// который в ES-графе вычисляется раньше. Используем store только для РЕАКТИВНОЙ
// части (наблюдение за спай-настройками); одноразовые lifecycle-чтения ниже
// остаются прямыми — ждать реактивной гидрации в service worker'е смысла нет.
import { settingsStore } from '../shared/store/index.js';
import { shallow } from 'zustand/shallow';

console.log('[VKify] Service worker started');
installPdfRenderRelay();

// Единственное место, где собираются зависимости.
// Порядок создания:
//   1. tokenManager  — нет зависимостей
//   2. notificationService — нет зависимостей
//   3. spyTracker    — зависит от notificationService + tokenManager
//   4. alarmManager  — нет зависимостей
//   5. messageHandler — зависит от всех выше

const tokenManager       = new VKTokenManager();
const notificationService = new NotificationService();
const telegramTransport = new BackgroundTelegramNotifier({
  readSettings: async () => readTelegramSettings(await chrome.storage.local.get([...TELEGRAM_SETTING_KEYS])),
  fetch: globalThis.fetch.bind(globalThis),
  readRecipient: async () => (await chrome.storage.local.get('telegram_resolved_recipient')).telegram_resolved_recipient as ResolvedTelegramRecipient | undefined,
  saveRecipient: recipient => chrome.storage.local.set({ telegram_resolved_recipient: recipient }),
  enrichPayload: async payload => {
    const messageId = Number(payload.data?.messageId);
    if (payload.type !== 'spy.new_message' || !Number.isSafeInteger(messageId) || messageId <= 0) return payload;
    const peerId = Number(payload.data?.peerId);
    const byConversation = Number.isSafeInteger(peerId) && peerId > 0;
    const result = object(await callVKApi(tokenManager, byConversation ? 'messages.getByConversationMessageId' : 'messages.getById', byConversation ? { peer_id: peerId, conversation_message_ids: String(messageId) } : { message_ids: String(messageId) }));
    const message = Array.isArray(result.items) ? object(result.items[0]) : {};
    if ((byConversation ? Number(message.conversation_message_id) : Number(message.id)) !== messageId || String(message.from_id) !== payload.data?.userId || message.out === 1) return payload;
    const original = cacheableApiMessage(message);
    if (original) await messageHandler.spyMessageCache.remember([original]);
    return { ...payload, data: { ...payload.data, photos: messagePhotos(message), attachments: messageAttachments(message) } };
  },
});
const telegramNotifier = new PersistentTelegramQueue({
  read: async () => (await chrome.storage.local.get(TELEGRAM_QUEUE_KEY))[TELEGRAM_QUEUE_KEY] as TelegramQueueState | undefined,
  write: state => chrome.storage.local.set({ [TELEGRAM_QUEUE_KEY]: state }),
  readSettings: async () => readTelegramSettings(await chrome.storage.local.get([...TELEGRAM_SETTING_KEYS])),
  transport: telegramTransport,
  ensureAlarm: async () => {
    if (!await chrome.alarms.get(TELEGRAM_QUEUE_ALARM)) await chrome.alarms.create(TELEGRAM_QUEUE_ALARM, { periodInMinutes: 1 });
  },
});
const spyTracker         = new SpyTracker(notificationService, tokenManager, telegramNotifier);
const profileTracker     = new ProfileTracker(notificationService, tokenManager, telegramNotifier);
const alarmManager       = new AlarmManager();
const messageHandler     = new MessageHandler(spyTracker, profileTracker, notificationService, tokenManager, telegramNotifier);
const messageRelay = new MessageRelay({
  read: keys => chrome.storage.local.get([...keys]),
  write: data => chrome.storage.local.set(data),
  remove: key => chrome.storage.local.remove(key),
  api: (method, params) => callVKApi(tokenManager, method, params),
  notifier: telegramNotifier,
});

const VK_CONTENT_MESSAGE_TYPES = new Set([
  'MUTATE_NOTES',
  'VK_TOKEN_UPDATE',
  'SHOW_NOTIFICATION',
  'DOWNLOAD_VIDEO',
  'AUDIO_FETCH_COVER',
  'AUDIO_FETCH_LYRICS',
  'AUDIO_FETCH_SEGMENT',
  'INJECT_AUDIO_ENCODER',
  'GET_PERF_TELEMETRY',
  'GET_FEATURE_REGISTRY_SUMMARY',
  'OPEN_PERF_DASHBOARD',
  'OPEN_MUSIC_SETTING',
  'TELEGRAM_SEND',
  'SPY_CACHE_MESSAGES',
]);

function isMessageAllowedFromContext(
  type: string,
  sender: chrome.runtime.MessageSender,
): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  if (!sender.url) return true; // service worker / extension runtime context

  let url: URL;
  try {
    url = new URL(sender.url);
  } catch {
    return false;
  }

  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return true;

  const isSiteBridge =
    url.hostname === 'vkify.ru' ||
    url.hostname.endsWith('.vkify.ru') ||
    (import.meta.env.DEV && url.hostname === 'localhost');
  if (isSiteBridge) return type === 'RELOAD_FEATURES';

  const isVkContent =
    url.hostname === 'vk.ru' ||
    url.hostname.endsWith('.vk.ru') ||
    url.hostname === 'vkvideo.ru' ||
    url.hostname.endsWith('.vkvideo.ru');
  return isVkContent && VK_CONTENT_MESSAGE_TYPES.has(type);
}


async function initialize(): Promise<void> {
  // Версионированные миграции storage — ДО любого чтения настроек, чтобы
  // дальнейший код видел уже актуальную схему (переименования/реструктуризацию).
  // Бывшая инлайновая правка spy_tracked_users → online_tracked_users теперь
  // живёт в migrate_v1_to_v2. Idempotent + конкуррентно-безопасно (общий промис).
  await migrator.migrate();

  await spyTracker.loadState();
  await profileTracker.loadState();
  await alarmManager.setupStorageMonitor();
  await telegramTransport.refreshConfiguration();
  await telegramNotifier.restore();
  void telegramNotifier.drain().catch(error => console.warn('[VKify] Telegram queue:', error));
  await messageRelay.syncAlarm();
  await messageHandler.autoAddFriends.restore();
  await messageHandler.groupParser.restore();

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

  if (settings.spy_online && (settings.online_tracked_users?.length ?? 0) > 0) {
    await spyTracker.start(settings);
  }

  if (settings.profile_spy && (settings.profile_tracked_users?.length ?? 0) > 0) {
    await profileTracker.start(settings);
  }
}

let initializationPromise: Promise<void> | null = null;

/**
 * MV3 workers can be created for any event, not only onStartup/onInstalled.
 * Keep initialization single-flight so messages and alarms never run against
 * trackers whose persisted state has not been loaded yet.
 */
function ensureInitialized(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = initialize().catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
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

  await ensureInitialized();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[VKify] Browser started');

  const data = await chrome.storage.local.get(StorageKey.PENDING_UPDATE_VERSION);
  if (data[StorageKey.PENDING_UPDATE_VERSION]) {
    chrome.tabs.create({ url: siteUrl(`/changelog/${data[StorageKey.PENDING_UPDATE_VERSION]}`) });
    await chrome.storage.local.remove(StorageKey.PENDING_UPDATE_VERSION);
  }

  await ensureInitialized();
});

chrome.runtime.setUninstallURL(siteUrl('/uninstall'));


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  let url: URL;
  try {
    url = new URL(tab.url);
  } catch {
    return;
  }

  if (url.hostname !== 'vk.ru' && !url.hostname.endsWith('.vk.ru')) return;

  const encoded = url.searchParams.get('vkify_theme');
  if (!encoded) return;

  await ensureInitialized();
  console.log('[VKify] Detected vkify_theme param in URL, applying theme...');

  const result = await messageHandler.handleApplySharedTheme(encoded);

  if (result.success) {
    await notificationService.show(
      `theme-applied-${Date.now()}`,
      'VKify — тема применена',
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
  // Свежая установка сразу на актуальной схеме — штампуем версию, чтобы Migrator
  // не принял засеянные дефолты за «легаси без версии» и не гонял миграции зря.
  await chrome.storage.local.set({ ...DEFAULT_SETTINGS, [SCHEMA_VERSION_KEY]: CURRENT_SCHEMA_VERSION });
}

async function handleUpdate(previousVersion: string, currentVersion: string): Promise<void> {
  console.log(`[VKify] Updated from ${previousVersion} to ${currentVersion}`);
  await chrome.storage.local.set({ [StorageKey.PENDING_UPDATE_VERSION]: currentVersion });
}


// Реактивное наблюдение за спай-настройками через каноничный settings-store
// (раньше — bespoke chrome.storage.onChanged со сравнением строковых ключей).
// store сам слушает onChanged, реконсилит изменения и через subscribeWithSelector
// дёргает нас только когда меняется именно выбранный срез. tuple-селектор +
// shallow: не-спай изменения сохраняют ссылки/значения и не триггерят перезапуск.
// Поведение под MV3 идентично прежнему — storage.onChanged не будит спящий SW ни
// в том, ни в другом случае; трекеры просыпаются по alarms.
settingsStore.subscribe(
  (s) => [s.settings.spy_online, s.settings.spy_online_interval, s.settings.online_tracked_users] as const,
  () => {
    console.log('[VKify] Online spy settings changed');
    void ensureInitialized().then(() => spyTracker.handleSettingsChange());
  },
  { equalityFn: shallow },
);

// Profile-spy — отдельный наблюдатель, не пересекается с online/activity.
settingsStore.subscribe(
  (s) => [s.settings.profile_spy, s.settings.profile_spy_interval, s.settings.profile_tracked_users] as const,
  () => {
    console.log('[VKify] Profile spy settings changed');
    void ensureInitialized().then(() => profileTracker.handleSettingsChange());
  },
  { equalityFn: shallow },
);


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object' || typeof (message as { type?: unknown }).type !== 'string') {
    sendResponse({ success: false, error: 'Invalid message' });
    return false;
  }
  if (!isMessageAllowedFromContext((message as { type: string }).type, sender)) {
    sendResponse({ success: false, error: 'Unauthorized sender' });
    return false;
  }

  ensureInitialized()
    .then(async () => {
      if (message.type === 'TELEGRAM_QUEUE_RETRY') { await telegramNotifier.retry(); return { success: true }; }
      return messageHandler.handle(message as ExtensionMessage, sender);
    })
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
  await ensureInitialized();
  if (alarm.name === TELEGRAM_QUEUE_ALARM) { await telegramNotifier.drain(); return; }
  if (alarm.name === MESSAGE_RELAY_ALARM) { await messageRelay.check(); return; }
  if (alarm.name === AUTO_ADD_ALARM) { await messageHandler.autoAddFriends.tick(); return; }
  if (alarm.name === GROUP_PARSER_ALARM) { await messageHandler.groupParser.tick(); return; }
  await alarmManager.handleAlarm(alarm.name, spyTracker, profileTracker);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && TELEGRAM_SETTING_KEYS.some(key => key in changes)) {
    void ensureInitialized().then(() => telegramNotifier.retry()).catch(error => console.warn('[VKify] Telegram queue:', error));
  }
  if (area !== 'local' || !MESSAGE_RELAY_KEYS.some(key => key in changes)) return;
  messageRelay.invalidate();
  void ensureInitialized().then(() => messageRelay.syncAlarm()).catch(() => undefined);
});


// ── Global media hotkeys ────────────────────────────────────────────────────
//
// Хоткеи плеера, объявленные в manifest.json → commands, доставляются сюда
// независимо от того, на какой вкладке сейчас пользователь. Это решает баг,
// когда in-page keydown-слушатель работал только на vk.ru и не отзывался,
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
