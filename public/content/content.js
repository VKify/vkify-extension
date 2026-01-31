class VKifyApp {
  constructor() {
    this.storage = storage;
    this.featureManager = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    console.log('%c[VKify] Initializing...', 'background: #0077ff; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;');

    try {
      // Проверяем первый запуск
      const firstRun = await this.storage.get('first_run');
      
      if (firstRun === null || firstRun === undefined) {
        await this.firstTimeSetup();
      }

      // Инициализируем менеджер функций
      this.featureManager = new FeatureManager(this.storage);
      await this.featureManager.init();

      // Отслеживаем навигацию (VK - SPA)
      this.observeNavigation();

      // Синхронизируем флаги анти-слежки
      await this.syncAntiTrackingFlags();

      // Проверяем страницу друзей для авто-добавления
      await this.checkAutoAddFriends();

      this.initialized = true;
      
      console.log('%c[VKify] ✓ Ready', 'background: #34c759; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;');

    } catch (error) {
      console.error('[VKify] Init error:', error);
    }
  }

  async firstTimeSetup() {
    console.log('[VKify] First time setup...');
    
    const defaults = getDefaultSettings();
    defaults.first_run = false;
    
    await this.storage.setMultiple(defaults);
    this.showWelcome();
  }

  async syncAntiTrackingFlags() {
    try {
      const preventTyping = await this.storage.get('prevent_typing');
      const preventRead = await this.storage.get('prevent_read');
      
      if (preventTyping || preventRead) {
        this.featureManager.injectAntiTrackingScript();
        
        setTimeout(() => {
          const event = new CustomEvent('vkify-update-settings', {
            detail: {
              prevent_typing: !!preventTyping,
              prevent_read: !!preventRead
            }
          });
          window.dispatchEvent(event);
        }, 150);
      }
      
    } catch (e) {
      console.error('[VKify] Failed to sync anti-tracking flags:', e);
    }
  }

  async checkAutoAddFriends() {
    if (window.location.href.includes('vk.com/friends')) {
      const autoAddEnabled = await this.storage.get('auto_add_friends');
      if (autoAddEnabled) {
        this.featureManager.enable('auto_add_friends');
      }
    }
  }

  showWelcome() {
    const notification = document.createElement('div');
    notification.id = 'vkify-welcome';
    notification.innerHTML = `
      <style>
        #vkify-welcome {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 10000;
          animation: vkify-slide-in 0.4s ease-out;
        }
        #vkify-welcome-content {
          background: linear-gradient(135deg, #0077ff 0%, #0055cc 100%);
          color: white;
          padding: 20px 24px;
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0, 119, 255, 0.35);
          max-width: 320px;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        #vkify-welcome h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 700;
        }
        #vkify-welcome p {
          margin: 0 0 16px 0;
          font-size: 14px;
          opacity: 0.9;
          line-height: 1.5;
        }
        #vkify-welcome button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          padding: 10px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background 0.2s;
        }
        #vkify-welcome button:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        @keyframes vkify-slide-in {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      </style>
      <div id="vkify-welcome-content">
        <h3>🎉 VKify установлен!</h3>
        <p>Расширение активировано. Нажмите на иконку в панели браузера, чтобы настроить.</p>
        <button onclick="this.closest('#vkify-welcome').remove()">Понятно</button>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentElement) {
        notification.style.animation = 'vkify-slide-in 0.3s ease-out reverse';
        setTimeout(() => notification.remove(), 300);
      }
    }, 7000);
  }

  observeNavigation() {
    let lastUrl = location.href;
    
    const observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.onPageChange();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  async onPageChange() {
    console.log('[VKify] Page:', location.pathname);
    
    await this.checkAutoAddFriends();
    
    if (this.featureManager) {
      const reapplyFeatures = [
        'block_feed_ads', 
        'block_left_ads',
        'hide_stories',
        'hide_recommendations',
        'hide_friends_suggestions',
        'custom_accent'
      ];
      
      reapplyFeatures.forEach(featureId => {
        if (this.featureManager.activeFeatures.has(featureId)) {
          setTimeout(() => {
            const handler = this.featureManager.getFeatureHandler(featureId);
            if (handler && handler.enable) {
              if (featureId === 'custom_accent') {
                this.storage.get('custom_accent').then(value => {
                  if (value) handler.enable(value);
                });
              } else {
                handler.enable();
              }
            }
          }, 300);
        }
      });
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'ENABLE_FEATURE':
        this.featureManager?.enable(message.featureId, message.value);
        if (message.featureId === 'prevent_typing' || message.featureId === 'prevent_read') {
          this.syncAntiTrackingFlags();
        }
        break;
      case 'DISABLE_FEATURE':
        this.featureManager?.disable(message.featureId);
        if (message.featureId === 'prevent_typing' || message.featureId === 'prevent_read') {
          this.syncAntiTrackingFlags();
        }
        break;
      case 'RELOAD_FEATURES':
        this.featureManager?.init();
        break;
    }
  }
}

// Инициализация
const app = new VKifyApp();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Слушаем сообщения от popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  app.handleMessage(message);
});

// Экспорт для отладки
window.VKify = app;