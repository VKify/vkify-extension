import { storage } from './storage.js';
import { FeatureManager } from './feature-manager.js';
import { InjectedScript } from './injected-scripts.js';
import { registerAllFeatures } from '../features/index.js';
import { TokenService } from '../services/token-service.js';
import { NavigationService } from '../services/navigation-service.js';
import { MessageService } from '../services/message-service.js';
import { WelcomeModal } from '../ui/welcome-modal.js';
import { ContextGuard } from '../utils/context-guard.js';
import { vkApiService } from './api/index.js';
import { createChannelNonce } from '../../shared/utils/page-channel.js';
import { reconcileThemeFromSettings, THEME_MIRROR_KEYS } from '../features/appearance/theme/mirror.js';

export class VKifyApp {
  private readonly storage = storage;
  private readonly vkApi = vkApiService;
  private readonly contextGuard: ContextGuard;

  // Per-page-load secret shared only with our injected scripts; gates the
  // token / native-API postMessage channels (see shared/utils/page-channel.ts).
  private readonly channelNonce = createChannelNonce();

  private featureManager: FeatureManager | null = null;
  private tokenService: TokenService | null = null;
  private navigationService: NavigationService | null = null;
  private messageService: MessageService | null = null;

  private initialized = false;
  private currentUserId: string | null = null;

  constructor() {
    this.contextGuard = new ContextGuard(() => this.cleanup());
  }

  get destroyed(): boolean {
    return this.contextGuard.destroyed;
  }

  async init(): Promise<void> {
    if (this.initialized || this.destroyed) return;

    if (!this.contextGuard.isValid()) {
      console.warn('[VKify] Cannot initialize: context invalid');
      return;
    }

    console.log('%c[VKify] Initializing...',
      'background: #0077ff; color: white; padding: 2px 8px; border-radius: 4px;');

    try {
      await this.initServices();
      await this.checkFirstRun();
      await this.setupFeatures();
      await this.startServices();

      this.initialized = true;

      console.log('%c[VKify] ✓ Ready',
        'background: #34c759; color: white; padding: 2px 8px; border-radius: 4px;');

    } catch (error) {
      if (this.contextGuard.isContextError(error)) {
        this.cleanup();
        return;
      }
      console.error('[VKify] Init error:', error);
    }
  }

  private async initServices(): Promise<void> {
    this.featureManager = new FeatureManager(this.storage);
    registerAllFeatures(this.featureManager);

    this.vkApi.setChannelNonce(this.channelNonce);

    this.tokenService = new TokenService(this.vkApi, this.storage, this.contextGuard, this.channelNonce);
    this.tokenService.events.on('userIdReceived', (userId) => {
      this.currentUserId = userId;
    });

    const getUserId = () => this.currentUserId;

    this.navigationService = new NavigationService(
      this.featureManager,
      this.storage,
      this.contextGuard,
    );

    this.messageService = new MessageService(
      this.featureManager,
      this.vkApi,
      this.tokenService,
      this.contextGuard,
      getUserId,
    );
  }

  private async checkFirstRun(): Promise<void> {
    const firstRun = await this.storage.get('first_run');

    // first_run defaults to `true` (see DEFAULT_SETTINGS).
    // It becomes `false` only after the modal has been shown once.
    // So we show the modal for any value that isn't explicitly false.
    if (firstRun !== false) {
      console.log('[VKify] First time setup...');
      await this.storage.set('first_run', false);

      // The content script runs at document_start, so document.body may not
      // exist yet. Defer the modal until the DOM is fully parsed.
      const showModal = () => WelcomeModal.show();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showModal, { once: true });
      } else {
        showModal();
      }
    }
  }

  private async setupFeatures(): Promise<void> {
    // Инжектируем API-бридж и листенер токена до инициализации фич,
    // чтобы токен был доступен, когда фичи начнут делать API-запросы.
    this.featureManager!.injectScript(InjectedScript.VK_API_BRIDGE, this.channelNonce);
    this.featureManager!.injectScript(InjectedScript.VK_TOKEN, this.channelNonce);
    this.tokenService!.setup();

    await this.featureManager!.init();

    // Тема: маркеры/переменные уже выставлены синхронно из зеркала в
    // document_start (см. theme/mirror.ts). Теперь, когда chrome.storage —
    // источник истины, детерминированно переприменяем тему (снимая то, что мог
    // выставить устаревший кэш) и освежаем зеркало для следующей загрузки.
    const settings = await this.storage.getAll();
    reconcileThemeFromSettings(settings);

    // Держим зеркало темы свежим: при любом изменении тема-настроек
    // (из попапа) перезаписываем кэш, чтобы следующая загрузка была мгновенной.
    this.storage.onChange((key) => {
      if (this.destroyed) return;
      if ((THEME_MIRROR_KEYS as readonly string[]).includes(key)) {
        this.storage.getAll().then((s) => {
          if (!this.destroyed) reconcileThemeFromSettings(s);
        }).catch(() => {});
      }
    });

    // Anti-tracking инжектируется после init() — он не влияет на работу фич,
    // но должен стартовать как можно раньше после загрузки страницы.
    this.featureManager!.injectScript(InjectedScript.ANTI_TRACKING, this.channelNonce);

    // Spy-скрипт требует, чтобы DOM страницы был готов к моменту инъекции,
    // иначе он не найдёт нужные элементы для мутации.
    await this.waitForDOMReady();

    if (!this.destroyed) {
      this.featureManager!.injectScript(InjectedScript.SPY, this.channelNonce);
    }
  }

  /**
   * Возвращает промис, который resolves, когда DOM готов.
   * Если документ уже загружен — resolves немедленно (без макротаски).
   */
  private waitForDOMReady(): Promise<void> {
    if (document.readyState !== 'loading') {
      return Promise.resolve();
    }

    return new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', () => resolve(), { once: true });
    });
  }

  private async startServices(): Promise<void> {
    this.navigationService!.start();
    this.messageService!.start();
    await this.navigationService!.checkCurrentPage();
  }

  cleanup(): void {
    if (this.destroyed) return;

    console.log('[VKify] Context invalidated, cleaning up...');
    this.contextGuard.markDestroyed();

    this.navigationService?.stop();
    this.messageService?.stop();
    this.tokenService?.stop();
    this.storage.cleanup?.();
  }

  getToken(): string | null {
    return this.vkApi.getToken();
  }

  getUserId(): string | null {
    return this.currentUserId;
  }
}