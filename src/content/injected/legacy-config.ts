import { registerResponseHook } from '../../shared/utils/fetch-hooks.js';

(function () {
  'use strict';

  const page = window as Window & { __vkifyLegacyConfig?: boolean };
  if (page.__vkifyLegacyConfig) return;
  page.__vkifyLegacyConfig = true;

  const state = {
    block_ads_feature_flags: false,
    block_music_ads: false,
  };

  // Explicit allowlist: flags whose names merely contain "ads" can be fixes or
  // ad-disabling switches, so broad substring matching could enable advertising.
  const AD_FLAGS_OFF = [
    'ads_legacy_routes',
    'feed_ad_posts_redesign',
    'feed_ads_cta_secondary_link_support_web',
    'feed_redesign_2024_extract_links_from_promo_post_web',
    'feed_redesign_ad_data_secondary',
    'frontend.ads_post_create_single_wall',
    'frontend.audio_ads_config_api',
    'frontend.combine_ads_request',
    'frontend.cta_promo_post',
    'frontend.embed_ad_events',
    'frontend.main_feed_widgets_and_ads_init_in_effect',
    'frontend.mini_apps_ads_cache_ttl',
    'frontend.mini_apps_ads_inter_multi_motion',
    'frontend.mini_apps_ads_inter_multi_single_request',
    'frontend.mini_apps_ads_sticky_motion',
    'frontend.mini_apps_ads_tech_stats',
    'frontend.mvk_clips_feed_ads_enabled',
    'frontend.spa_feed_ads_register_event',
    'frontend.stories_ads_mvk',
    'frontend.use_old_ads_params_in_uv_player',
    'frontend.video_player_install_promo_banner',
    'frontend.video_player_install_promo_popup',
    'frontend.web_audiopleyer_advertising_police_combo_13501',
    'frontend.yandex_browser_promo_check_enabled',
    'mini_apps_ads_banner_redesign_v3',
    'mini_apps_ads_interstitial_multi',
  ] as const;

  const AD_TOGGLES_OFF = [
    'feed_dzen_article_mid_ad',
    'feed_dzen_article_mid_ad_paddi',
    'feed_dzen_article_top_ad',
    'feed_legacy_page_seen_ads_stat',
    'feed_motion_proxy_promo_all',
    'sa_ads_closing_banner',
    'sa_ads_interstitial_pause_ads',
  ] as const;

  const AD_TOGGLES_ON = [
    'video_web_instream_ads_off',
  ] as const;

  const AD_FLAGS_ON = [
    'audio_studio_ads_block_enabled',
    'frontend.video_fix_disable_ad_button_init_web',
  ] as const;

  function isLegacyConfigUrl(url: string): boolean {
    try {
      const parsed = new URL(url, location.href);
      return /(^|\.)vk\.(?:ru|com)$/.test(parsed.hostname)
        && parsed.pathname === '/al_loader_part_configs.php'
        && parsed.searchParams.get('act') === 'load_legacy';
    } catch { return false; }
  }

  function isAccountInfoUrl(url: string): boolean {
    try {
      const parsed = new URL(url, location.href);
      return /(^|\.)vk\.(?:ru|com)$/.test(parsed.hostname)
        && parsed.pathname === '/method/account.getInfo';
    } catch { return false; }
  }

  function applyOverrides(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    const root = data as { pe?: Record<string, unknown>; toggles?: Record<string, unknown> };
    if (!root.pe || typeof root.pe !== 'object') return data;
    if (state.block_ads_feature_flags) {
      AD_FLAGS_OFF.forEach(key => { root.pe![key] = 0; });
      AD_FLAGS_ON.forEach(key => { root.pe![key] = 1; });
      if (root.toggles && typeof root.toggles === 'object') {
        AD_TOGGLES_OFF.forEach(key => { delete root.toggles![key]; });
        AD_TOGGLES_ON.forEach(key => { root.toggles![key] = { abGroupId: null }; });
      }
    }
    return data;
  }

  function stripAudioAds(data: unknown): unknown {
    if (!state.block_music_ads || !data || typeof data !== 'object') return data;
    const response = (data as { response?: Record<string, unknown> }).response;
    if (!response || typeof response !== 'object') return data;
    delete response.audio_ads;
    if (Array.isArray(response.settings)) {
      response.settings = response.settings.filter(item =>
        !item || typeof item !== 'object' || (item as { name?: unknown }).name !== 'audio_ads');
    }
    return data;
  }

  function overrideJsonText(text: string, url: string): string | null {
    try {
      const data = JSON.parse(text);
      if (isLegacyConfigUrl(url)) applyOverrides(data);
      if (isAccountInfoUrl(url)) stripAudioAds(data);
      return JSON.stringify(data);
    } catch { return null; }
  }

  const unregister = registerResponseHook(async (url, response) => {
    if ((!isLegacyConfigUrl(url) && !isAccountInfoUrl(url)) || !Object.values(state).some(Boolean)) return response;
    try {
      const data = await response.clone().json();
      if (isLegacyConfigUrl(url)) applyOverrides(data);
      if (isAccountInfoUrl(url)) stripAudioAds(data);
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.delete('content-length');
      return new Response(JSON.stringify(data), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch { return response; }
  });

  // Legacy VK modules may use XMLHttpRequest instead of fetch for this endpoint.
  const xhrUrls = new WeakMap<XMLHttpRequest, string>();
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  const patchedOpen = function (this: XMLHttpRequest, method: string, url: string | URL, ...args: unknown[]): void {
    xhrUrls.set(this, String(url));
    Reflect.apply(originalOpen, this, [method, url, ...args]);
  } as typeof XMLHttpRequest.prototype.open;
  const patchedSend = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null): void {
    const url = xhrUrls.get(this) ?? '';
    if (isLegacyConfigUrl(url) || isAccountInfoUrl(url)) {
      let applied = false;
      this.addEventListener('readystatechange', () => {
        if (applied || this.readyState !== XMLHttpRequest.DONE || !Object.values(state).some(Boolean)) return;
        applied = true;
        let text: string;
        try {
          text = this.responseType === 'json' ? JSON.stringify(this.response) : this.responseText;
        } catch { return; }
        const replacement = overrideJsonText(text, url);
        if (replacement === null) return;
        try {
          const responseValue = this.responseType === 'json' ? JSON.parse(replacement) : replacement;
          const descriptors: PropertyDescriptorMap = {
            response: { configurable: true, value: responseValue },
          };
          if (this.responseType === '' || this.responseType === 'text') {
            descriptors.responseText = { configurable: true, value: replacement };
          }
          Object.defineProperties(this, descriptors);
        } catch { /* Some engines expose non-configurable response properties. */ }
      }, { capture: true });
    }
    originalSend.call(this, body);
  };
  XMLHttpRequest.prototype.open = patchedOpen;
  XMLHttpRequest.prototype.send = patchedSend;

  const handleLegacyUpdate = ((event: CustomEvent) => {
    const detail = event.detail;
    if (!detail || typeof detail !== 'object') return;
    if (typeof detail.block_ads_feature_flags === 'boolean') state.block_ads_feature_flags = detail.block_ads_feature_flags;
    if (typeof detail.block_music_ads === 'boolean') state.block_music_ads = detail.block_music_ads;
  }) as EventListener;
  const handleSettingsUpdate = ((event: CustomEvent) => {
    if (typeof event.detail?.block_music_ads === 'boolean') state.block_music_ads = event.detail.block_music_ads;
  }) as EventListener;
  window.addEventListener('vkify-update-legacy-config', handleLegacyUpdate);
  window.addEventListener('vkify-update-settings', handleSettingsUpdate);

  window.addEventListener('message', (event) => {
    if (event.source === window && event.data?.type === 'VKIFY_DESTROY') {
      unregister();
      if (XMLHttpRequest.prototype.open === patchedOpen) XMLHttpRequest.prototype.open = originalOpen;
      if (XMLHttpRequest.prototype.send === patchedSend) XMLHttpRequest.prototype.send = originalSend;
      window.removeEventListener('vkify-update-legacy-config', handleLegacyUpdate);
      window.removeEventListener('vkify-update-settings', handleSettingsUpdate);
      delete page.__vkifyLegacyConfig;
    }
  });

  window.dispatchEvent(new CustomEvent('vkify-script-ready', {
    detail: { name: 'legacy-config' },
  }));
})();
