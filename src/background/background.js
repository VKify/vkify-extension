console.log('[VKify] Service worker started');

// =======================
// УСТАНОВКА / ОБНОВЛЕНИЕ
// =======================
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[VKify] onInstalled:', details.reason);

  if (details.reason === 'install') {
    await handleFirstInstall();
    // Открываем страницу приветствия на сайте
    chrome.tabs.create({
      url: 'https://vkify.ru/welcome'
    });
  }

  if (details.reason === 'update') {
    const previousVersion = details.previousVersion;
    const currentVersion = chrome.runtime.getManifest().version;
    await handleUpdate(previousVersion, currentVersion);
  }

  // Планировщик мониторинга storage (каждые 30 минут)
  chrome.alarms.create('monitorStorage', {
    periodInMinutes: 30
  });
});

// =======================
// ЗАПУСК БРАУЗЕРА
// =======================
chrome.runtime.onStartup.addListener(async () => {
  console.log('[VKify] Browser started');
  
  // Проверяем, есть ли отложенное уведомление об обновлении
  const data = await chrome.storage.local.get('pending_update_version');
  
  if (data.pending_update_version) {
    const version = data.pending_update_version;
    
    // Открываем changelog
    chrome.tabs.create({
      url: `https://vkify.ru/changelog/${version}`
    });
    
    // Удаляем флаг, чтобы не показывать повторно
    await chrome.storage.local.remove('pending_update_version');
    
    console.log(`[VKify] Showed changelog for version ${version}`);
  }
});

// =======================
// УДАЛЕНИЕ РАСШИРЕНИЯ
// =======================
chrome.runtime.setUninstallURL('https://vkify.ru/uninstall');

// =======================
// ПЕРВАЯ УСТАНОВКА
// =======================
async function handleFirstInstall() {
  console.log('[VKify] First install');

  const defaults = {
    advertising_left: true,
    ads_Feed: true,
    first_run: true,
    extension_theme: 'auto'
  };

  await chrome.storage.local.set(defaults);
}

// =======================
// ОБНОВЛЕНИЕ
// =======================
async function handleUpdate(previousVersion, currentVersion) {
  console.log(`[VKify] Updated from ${previousVersion} to ${currentVersion}`);
  
  // Сохраняем версию для показа при следующем запуске браузера
  await chrome.storage.local.set({
    pending_update_version: currentVersion
  });
  
}

// =======================
// СООБЩЕНИЯ
// =======================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[VKify] Message:', message);

  switch (message.type) {
    case 'GET_SETTINGS':
      chrome.storage.local.get(null).then(settings => {
        sendResponse({ settings });
      });
      return true;

    case 'STORAGE_CHANGED':
      notifyAllVKTabs(message);
      break;

    default:
      console.warn('[VKify] Unknown message type:', message.type);
  }
});

// =======================
// УВЕДОМЛЕНИЕ ВК-ВКЛАДОК
// =======================
async function notifyAllVKTabs(message) {
  const tabs = await chrome.tabs.query({
    url: '*://*.vk.com/*'
  });

  for (const tab of tabs) {
    if (!tab.id) continue;

    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      // вкладка может быть без content-script
    }
  }
}

// =======================
// ALARMS
// =======================
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'monitorStorage') {
    monitorStorage();
  }
});

// =======================
// МОНИТОРИНГ STORAGE
// =======================
async function monitorStorage() {
  try {
    const bytes = await chrome.storage.local.getBytesInUse();
    const quota = chrome.storage.local.QUOTA_BYTES || 5242880;
    const percent = (bytes / quota) * 100;

    console.log(`[VKify] Storage: ${bytes} bytes (${percent.toFixed(1)}%)`);

    if (percent > 80) {
      console.warn('[VKify] Storage usage is high');
    }
  } catch (err) {
    console.error('[VKify] Storage error:', err);
  }
}

// =======================
// ОБРАБОТКА ОШИБОК
// =======================
self.addEventListener('error', (event) => {
  console.error('[VKify] SW error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[VKify] Unhandled rejection:', event.reason);
});

console.log('[VKify] Service worker ready');