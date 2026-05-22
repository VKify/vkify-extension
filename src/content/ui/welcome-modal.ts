export class WelcomeModal {
  static show(): void {
    if (document.getElementById('vkify-welcome')) return;

    const el = document.createElement('div');
    el.id = 'vkify-welcome';
    el.innerHTML = this.getTemplate();
    document.body.appendChild(el);
    this.setupEventHandlers(el);
  }

  private static getTemplate(): string {
    return `
      <style>${this.getStyles()}</style>
      <div id="vkify-welcome-card">

        <div class="vkw-header">
          <div class="vkw-logo">
            <svg viewBox="0 0 231 148" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M73.711 1.83982L97.0564 57.5097C97.9202 59.5696 100.652 59.9968 102.103 58.2988L151.041 1.05066C151.611 0.383902 152.444 0 153.322 0H221.115C223.645 0 225.039 2.93882 223.438 4.898L107.853 146.382C107.275 147.089 106.408 147.494 105.496 147.484L63.8875 147.022C62.7028 147.008 61.6367 146.299 61.1668 145.211L0.249245 4.18967C-0.606304 2.2091 0.845833 0 3.00328 0H70.9444C72.153 0 73.2436 0.725252 73.711 1.83982Z" fill="currentColor"/>
              <path d="M138.702 122.916L173.168 82.1842C174.36 80.7756 176.529 80.7667 177.733 82.1655L229.675 142.544C231.349 144.488 229.967 147.5 227.401 147.5H160.202C159.395 147.5 158.621 147.175 158.057 146.597L138.848 126.952C137.766 125.845 137.703 124.098 138.702 122.916Z" fill="currentColor"/>
            </svg>
          </div>
          <div>
            <div class="vkw-title">Добро пожаловать!</div>
            <div class="vkw-subtitle">VKify успешно установлен</div>
          </div>
        </div>

        <div class="vkw-divider"></div>

        <div class="vkw-features">
          <div class="vkw-feature">
            <div class="vkw-feature-icon vkw-icon-blue">🎨</div>
            <div class="vkw-feature-body">
              <div class="vkw-feature-title">Внешний вид</div>
              <div class="vkw-feature-desc">80+ тем, 60+ шрифтов, обои и фильтры</div>
            </div>
          </div>
          <div class="vkw-feature">
            <div class="vkw-feature-icon vkw-icon-red">🛡️</div>
            <div class="vkw-feature-body">
              <div class="vkw-feature-title">Блокировка рекламы</div>
              <div class="vkw-feature-desc">Реклама в ленте, баннеры, трекеры</div>
            </div>
          </div>
          <div class="vkw-feature">
            <div class="vkw-feature-icon vkw-icon-green">🔒</div>
            <div class="vkw-feature-body">
              <div class="vkw-feature-title">Приватность</div>
              <div class="vkw-feature-desc">Скрытие диалогов, антитрекинг</div>
            </div>
          </div>
          <div class="vkw-feature">
            <div class="vkw-feature-icon vkw-icon-purple">👁️</div>
            <div class="vkw-feature-body">
              <div class="vkw-feature-title">Онлайн-слежка</div>
              <div class="vkw-feature-desc">Уведомления об активности пользователей</div>
            </div>
          </div>
        </div>

        <div class="vkw-divider"></div>

        <div class="vkw-hint">
          <div class="vkw-hint-icon">🧩</div>
          <div class="vkw-hint-text">
            Нажми на иконку расширений в браузере и выбери <strong>VKify</strong>, чтобы открыть настройки
          </div>
        </div>

        <button class="vkw-btn" id="vkify-welcome-btn">Начать использовать</button>

      </div>
    `;
  }

  private static getStyles(): string {
    return `
      #vkify-welcome {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        animation: vkw-fade-in 0.25s ease-out;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      #vkify-welcome-card {
        background: #1c1c1e;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 20px;
        padding: 24px;
        width: 100%;
        max-width: 400px;
        margin: 16px;
        box-shadow:
          0 32px 64px rgba(0, 0, 0, 0.5),
          0 0 0 1px rgba(255, 255, 255, 0.04) inset;
        animation: vkw-slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      }

      /* ── Header ── */
      .vkw-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 20px;
      }

      .vkw-logo {
        flex-shrink: 0;
        width: 44px;
        height: 44px;
        background: linear-gradient(135deg, #0077ff, #0055cc);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
        box-shadow: 0 4px 16px rgba(0, 119, 255, 0.35);
        color: white;
      }

      .vkw-logo svg {
        width: 100%;
        height: 100%;
      }

      .vkw-title {
        font-size: 17px;
        font-weight: 700;
        color: #ffffff;
        line-height: 1.2;
      }

      .vkw-subtitle {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.45);
        margin-top: 2px;
      }

      /* ── Divider ── */
      .vkw-divider {
        height: 1px;
        background: rgba(255, 255, 255, 0.07);
        margin: 0 0 20px;
      }

      /* ── Features ── */
      .vkw-features {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 20px;
      }

      .vkw-feature {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        transition: background 0.15s;
      }

      .vkw-feature:hover {
        background: rgba(255, 255, 255, 0.04);
      }

      .vkw-feature-icon {
        flex-shrink: 0;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      }

      .vkw-icon-blue   { background: rgba(0, 119, 255, 0.15); }
      .vkw-icon-red    { background: rgba(255, 59,  48,  0.15); }
      .vkw-icon-green  { background: rgba(52,  199, 89,  0.15); }
      .vkw-icon-purple { background: rgba(175, 82,  222, 0.15); }

      .vkw-feature-title {
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
        line-height: 1.3;
      }

      .vkw-feature-desc {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.45);
        margin-top: 1px;
      }

      /* ── Hint ── */
      .vkw-hint {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        background: rgba(0, 119, 255, 0.08);
        border: 1px solid rgba(0, 119, 255, 0.2);
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 16px;
      }

      .vkw-hint-icon {
        font-size: 16px;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .vkw-hint-text {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
        line-height: 1.5;
      }

      .vkw-hint-text strong {
        color: #5eb5ff;
        font-weight: 600;
      }

      /* ── Button ── */
      .vkw-btn {
        width: 100%;
        padding: 13px;
        background: #0077ff;
        border: none;
        border-radius: 12px;
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: background 0.15s, transform 0.1s;
        box-shadow: 0 4px 16px rgba(0, 119, 255, 0.35);
      }

      .vkw-btn:hover  { background: #0066dd; }
      .vkw-btn:active { transform: scale(0.98); }

      /* ── Animations ── */
      @keyframes vkw-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      @keyframes vkw-slide-up {
        from { opacity: 0; transform: translateY(16px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }

      @keyframes vkw-fade-out {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
    `;
  }

  private static setupEventHandlers(el: HTMLElement): void {
    const close = (): void => {
      el.style.animation = 'vkw-fade-out 0.2s ease-out forwards';
      setTimeout(() => el.remove(), 200);
    };

    document.getElementById('vkify-welcome-btn')?.addEventListener('click', close);

    el.addEventListener('click', (e) => {
      if (e.target === el) close();
    });

    const escHandler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
}