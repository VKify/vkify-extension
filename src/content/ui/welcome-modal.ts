import { t } from '@/content/i18n/index.js';
import { setTrustedHtml } from '@/content/utils/trusted-html.js';
import { WELCOME_ICONS } from './welcome-icons.js';

export class WelcomeModal {
  static show(): void {
    if (document.getElementById('vkify-welcome')) return;

    const el = document.createElement('div');
    el.id = 'vkify-welcome';
    setTrustedHtml(el, this.getTemplate());

    // DOMParser relocates <style> from parsed body markup into the temporary
    // document's <head>, while parseTrustedFragment intentionally returns only
    // body nodes. Create the stylesheet explicitly so it is not discarded.
    const style = document.createElement('style');
    style.id = 'vkify-welcome-styles';
    style.textContent = this.getStyles();
    el.prepend(style);

    document.body.appendChild(el);
    this.setupEventHandlers(el);
  }

  private static getTemplate(): string {
    return `
      <div id="vkify-welcome-card" role="dialog" aria-modal="true" aria-labelledby="vkify-welcome-title">
        <div class="vkw-glow vkw-glow-primary"></div>
        <div class="vkw-glow vkw-glow-secondary"></div>
        <button class="vkw-close" id="vkify-welcome-close" type="button" aria-label="${t('welcome.close')}">${WELCOME_ICONS.close}</button>

        <div class="vkw-hero">
          <div class="vkw-brand-row">
            <div class="vkw-logo">
              <svg viewBox="0 0 231 148" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M73.711 1.83982L97.0564 57.5097C97.9202 59.5696 100.652 59.9968 102.103 58.2988L151.041 1.05066C151.611 0.383902 152.444 0 153.322 0H221.115C223.645 0 225.039 2.93882 223.438 4.898L107.853 146.382C107.275 147.089 106.408 147.494 105.496 147.484L63.8875 147.022C62.7028 147.008 61.6367 146.299 61.1668 145.211L0.249245 4.18967C-0.606304 2.2091 0.845833 0 3.00328 0H70.9444C72.153 0 73.2436 0.725252 73.711 1.83982Z" fill="currentColor"/>
                <path d="M138.702 122.916L173.168 82.1842C174.36 80.7756 176.529 80.7667 177.733 82.1655L229.675 142.544C231.349 144.488 229.967 147.5 227.401 147.5H160.202C159.395 147.5 158.621 147.175 158.057 146.597L138.848 126.952C137.766 125.845 137.703 124.098 138.702 122.916Z" fill="currentColor"/>
              </svg>
            </div>
            <div class="vkw-status"><span></span>${t('welcome.status')}</div>
          </div>
          <h2 class="vkw-title" id="vkify-welcome-title">${t('welcome.title')}</h2>
          <p class="vkw-subtitle">${t('welcome.subtitle')}</p>
        </div>

        <div class="vkw-features">
          <div class="vkw-feature">
            <div class="vkw-feature-icon vkw-icon-blue">${WELCOME_ICONS.palette}</div>
            <div class="vkw-feature-body">
              <div class="vkw-feature-title">${t('welcome.features.appearance_title')}</div>
              <div class="vkw-feature-desc">${t('welcome.features.appearance_desc')}</div>
            </div>
          </div>
          <div class="vkw-feature">
            <div class="vkw-feature-icon vkw-icon-red">${WELCOME_ICONS.advertising}</div>
            <div class="vkw-feature-body">
              <div class="vkw-feature-title">${t('welcome.features.ads_title')}</div>
              <div class="vkw-feature-desc">${t('welcome.features.ads_desc')}</div>
            </div>
          </div>
          <div class="vkw-feature">
            <div class="vkw-feature-icon vkw-icon-green">${WELCOME_ICONS.messages}</div>
            <div class="vkw-feature-body">
              <div class="vkw-feature-title">${t('welcome.features.chats_title')}</div>
              <div class="vkw-feature-desc">${t('welcome.features.chats_desc')}</div>
            </div>
          </div>
          <div class="vkw-feature">
            <div class="vkw-feature-icon vkw-icon-purple">${WELCOME_ICONS.lock}</div>
            <div class="vkw-feature-body">
              <div class="vkw-feature-title">${t('welcome.features.privacy_title')}</div>
              <div class="vkw-feature-desc">${t('welcome.features.privacy_desc')}</div>
            </div>
          </div>
        </div>

        <div class="vkw-actions">
          <a class="vkw-btn vkw-btn-primary" id="vkify-welcome-settings" href="https://vk.ru/vkify_settings">
            <span>${t('welcome.settings_cta')}</span>${WELCOME_ICONS.chevron}
          </a>
          <button class="vkw-btn vkw-btn-secondary" id="vkify-welcome-btn" type="button">${t('welcome.cta')}</button>
        </div>
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
      .vkw-icon-cyan   { background: rgba(50,  173, 230, 0.15); }
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

      /* ── Current welcome layout ── */
      #vkify-welcome {
        box-sizing: border-box;
        padding: 20px;
        background: rgba(8, 12, 20, 0.64);
        backdrop-filter: blur(14px) saturate(125%);
        -webkit-backdrop-filter: blur(14px) saturate(125%);
      }

      #vkify-welcome *,
      #vkify-welcome *::before,
      #vkify-welcome *::after { box-sizing: border-box; }

      #vkify-welcome-card {
        position: relative;
        isolation: isolate;
        overflow-x: hidden;
        overflow-y: hidden;
        max-width: 560px;
        max-height: none;
        margin: 0;
        padding: 28px;
        color: #f5f8ff;
        background: linear-gradient(155deg, rgba(29, 37, 53, 0.98), rgba(15, 20, 31, 0.99));
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 28px;
        box-shadow: 0 32px 90px rgba(0, 0, 0, 0.46), inset 0 1px 0 rgba(255, 255, 255, 0.06);
      }

      .vkw-glow {
        position: absolute;
        z-index: -1;
        border-radius: 50%;
        pointer-events: none;
        filter: blur(8px);
      }

      .vkw-glow-primary {
        width: 260px;
        height: 260px;
        top: -150px;
        left: -80px;
        background: radial-gradient(circle, rgba(0, 119, 255, 0.33), transparent 68%);
      }

      .vkw-glow-secondary {
        width: 220px;
        height: 220px;
        right: -110px;
        bottom: -130px;
        background: radial-gradient(circle, rgba(126, 87, 255, 0.22), transparent 68%);
      }

      .vkw-close {
        position: absolute;
        z-index: 2;
        top: 18px;
        right: 18px;
        width: 34px;
        height: 34px;
        padding: 0 0 2px;
        color: rgba(255, 255, 255, 0.62);
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 50%;
        font: 400 24px/1 inherit;
        cursor: pointer;
        transition: color 0.15s, background 0.15s, transform 0.15s;
      }

      .vkw-close:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.1);
        transform: rotate(4deg);
      }

      .vkw-hero { margin-bottom: 24px; }

      .vkw-brand-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
      }

      .vkw-logo {
        width: 46px;
        height: 46px;
        padding: 11px;
        background: linear-gradient(145deg, #1689ff, #0062db);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 15px;
        box-shadow: 0 10px 28px rgba(0, 119, 255, 0.3);
      }

      .vkw-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 6px 10px;
        color: #a9e9c2;
        background: rgba(59, 211, 126, 0.09);
        border: 1px solid rgba(89, 224, 147, 0.16);
        border-radius: 999px;
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.02em;
      }

      .vkw-status span {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #48d989;
        box-shadow: 0 0 0 4px rgba(72, 217, 137, 0.12);
      }

      .vkw-title {
        max-width: 440px;
        margin: 0;
        color: #fff;
        font-size: clamp(27px, 5vw, 36px);
        font-weight: 760;
        line-height: 1.08;
        letter-spacing: -0.035em;
      }

      .vkw-subtitle {
        max-width: 470px;
        margin: 10px 0 0;
        color: rgba(229, 237, 252, 0.62);
        font-size: 14px;
        line-height: 1.55;
      }

      .vkw-features {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 18px;
      }

      .vkw-feature {
        align-items: flex-start;
        gap: 11px;
        min-height: 92px;
        padding: 14px;
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.065);
        border-radius: 17px;
        transition: transform 0.18s, border-color 0.18s, background 0.18s;
      }

      .vkw-feature:hover {
        transform: translateY(-2px);
        background: rgba(255, 255, 255, 0.055);
        border-color: rgba(255, 255, 255, 0.11);
      }

      .vkw-feature-icon {
        width: 38px;
        height: 38px;
        border-radius: 12px;
      }

      .vkw-icon-svg {
        display: block;
        width: 20px;
        height: 20px;
      }

      .vkw-close-svg {
        display: block;
        width: 20px;
        height: 20px;
        margin: auto;
      }

      .vkw-icon-blue   { background: linear-gradient(145deg, rgba(38, 146, 255, 0.24), rgba(0, 98, 219, 0.12)); }
      .vkw-icon-red    { background: linear-gradient(145deg, rgba(255, 91, 91, 0.22), rgba(255, 59, 48, 0.1)); }
      .vkw-icon-green  { background: linear-gradient(145deg, rgba(65, 211, 132, 0.22), rgba(33, 169, 96, 0.1)); }
      .vkw-icon-purple { background: linear-gradient(145deg, rgba(164, 116, 255, 0.24), rgba(112, 69, 221, 0.1)); }
      .vkw-feature-body { min-width: 0; }

      .vkw-feature-title {
        color: rgba(255, 255, 255, 0.94);
        font-weight: 680;
      }

      .vkw-feature-desc {
        margin-top: 4px;
        color: rgba(222, 231, 247, 0.5);
        font-size: 11.5px;
        line-height: 1.38;
      }

      .vkw-actions {
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        gap: 10px;
      }

      .vkw-btn {
        min-height: 46px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 0 16px;
        border-radius: 14px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 650;
        line-height: 1;
        text-decoration: none;
        transition: background 0.16s, border-color 0.16s, transform 0.1s, box-shadow 0.16s;
      }

      .vkw-btn-primary {
        color: #fff;
        background: linear-gradient(135deg, #1689ff, #0067e6);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 10px 28px rgba(0, 103, 230, 0.26);
      }

      .vkw-btn-primary:hover {
        background: linear-gradient(135deg, #2793ff, #0872f4);
        box-shadow: 0 12px 32px rgba(0, 103, 230, 0.34);
      }

      .vkw-arrow {
        width: 18px;
        height: 18px;
        transition: transform 0.16s;
      }
      .vkw-btn-primary:hover .vkw-arrow { transform: translateX(3px); }

      .vkw-btn-secondary {
        color: rgba(241, 246, 255, 0.78);
        background: rgba(255, 255, 255, 0.055);
        border: 1px solid rgba(255, 255, 255, 0.09);
        box-shadow: none;
      }

      .vkw-btn-secondary:hover {
        color: #fff;
        background: rgba(255, 255, 255, 0.09);
        border-color: rgba(255, 255, 255, 0.14);
      }

      @media (max-width: 520px) {
        #vkify-welcome { padding: 10px; }
        #vkify-welcome-card {
          max-height: none;
          padding: 22px 18px 18px;
          border-radius: 22px;
        }
        .vkw-close { top: 14px; right: 14px; }
        .vkw-features { grid-template-columns: 1fr; }
        .vkw-feature { min-height: auto; }
        .vkw-actions { grid-template-columns: 1fr; }
      }

      @media (max-height: 700px) and (min-width: 521px) {
        #vkify-welcome-card { padding: 20px 24px; }
        .vkw-close { top: 14px; right: 14px; }
        .vkw-hero { margin-bottom: 14px; }
        .vkw-brand-row { margin-bottom: 10px; }
        .vkw-title { font-size: 28px; }
        .vkw-subtitle { margin-top: 6px; font-size: 12.5px; line-height: 1.4; }
        .vkw-features { gap: 8px; margin-bottom: 14px; }
        .vkw-feature { min-height: 76px; padding: 10px 12px; }
        .vkw-btn { min-height: 42px; }
      }

      @media (prefers-reduced-motion: reduce) {
        #vkify-welcome,
        #vkify-welcome-card,
        .vkw-feature,
        .vkw-btn,
        .vkw-arrow { animation: none !important; transition: none !important; }
      }

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
    let closing = false;

    const close = (): void => {
      if (closing) return;
      closing = true;
      document.removeEventListener('keydown', escHandler);
      el.style.animation = 'vkw-fade-out 0.2s ease-out forwards';
      setTimeout(() => el.remove(), 200);
    };

    document.getElementById('vkify-welcome-btn')?.addEventListener('click', close);
    document.getElementById('vkify-welcome-close')?.addEventListener('click', close);
    document.getElementById('vkify-welcome-settings')?.addEventListener('click', close);

    el.addEventListener('click', (e) => {
      if (e.target === el) close();
    });

    function escHandler(e: KeyboardEvent): void {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', escHandler);
  }
}
