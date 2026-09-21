// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const update = (detail: Record<string, unknown>) => window.dispatchEvent(
  new CustomEvent('vkify-update-legacy-config', { detail }),
);

beforeEach(async () => {
  vi.resetModules();
  window.location.href = 'https://vk.ru/feed';
  window.fetch = vi.fn(async () => new Response(JSON.stringify({ pe: {
    'ads_legacy_routes': 1,
    'frontend.audio_ads_config_api': 1,
    'frontend.use_old_ads_params_in_uv_player': 1,
    'audio_studio_ads_block_enabled': 0,
    'frontend.profile_snowballs': 1,
    'web_spa_easter_eggs_force': 1,
    unrelated: 1,
  }, toggles: {
    feed_legacy_page_seen_ads_stat: { abGroupId: null },
    sa_ads_closing_banner: { abGroupId: null },
    sa_ads_interstitial_pause_ads: { abGroupId: null },
    video_web_instream_ads_off: { abGroupId: 123 },
    unrelated_toggle: { abGroupId: null },
  } }), { headers: { 'content-type': 'application/json' } }));
  await import('../content/injected/legacy-config.js');
});

afterEach(() => {
  window.dispatchEvent(new MessageEvent('message', {
    source: window,
    data: { type: 'VKIFY_DESTROY' },
  }));
});

describe('legacy VK config overrides', () => {
  it('uses blocking defaults before the asynchronous storage event arrives', async () => {
    const result = await (await window.fetch(
      'https://vk.ru/al_loader_part_configs.php?act=load_legacy',
    )).json();
    expect(result.pe['frontend.audio_ads_config_api']).toBe(0);
    expect(result.pe.audio_studio_ads_block_enabled).toBe(1);
    expect(result.toggles).not.toHaveProperty('sa_ads_interstitial_pause_ads');
  });

  it('changes only explicitly controlled flags', async () => {
    update({
      block_ads_feature_flags: true,
    });
    const result = await (await window.fetch(
      'https://vk.ru/al_loader_part_configs.php?act=load_legacy',
    )).json();
    expect(result.pe).toMatchObject({
      'frontend.audio_ads_config_api': 0,
      'frontend.use_old_ads_params_in_uv_player': 0,
      'audio_studio_ads_block_enabled': 1,
      'frontend.profile_snowballs': 1,
      'web_spa_easter_eggs_force': 1,
      unrelated: 1,
    });
    expect(result.toggles).toEqual({
      video_web_instream_ads_off: { abGroupId: null },
      unrelated_toggle: { abGroupId: null },
    });
  });

  it('removes audio ad configuration from account.getInfo', async () => {
    const coordinator = Reflect.get(window, '__vkifyFetchCoordinator');
    coordinator.original.mockImplementation(async () => new Response(JSON.stringify({ response: {
      audio_ads: { day_limit: 100, track_limit: 1, types_allowed: ['preroll'] },
      settings: [{ available: true, forced: false, name: 'audio_ads' }, { name: 'other' }],
      obscene_text_filter: false,
    } })));
    update({ block_music_ads: true });
    const result = await (await window.fetch(
      'https://web.api.vk.ru/method/account.getInfo?v=5.289&client_id=6287487',
      { method: 'POST' },
    )).json();
    expect(result.response.audio_ads).toBeUndefined();
    expect(result.response.settings).toEqual([{ name: 'other' }]);
    expect(result.response.obscene_text_filter).toBe(false);
  });

  it('leaves unrelated hosts and disabled overrides untouched', async () => {
    update({ block_ads_feature_flags: true });
    const external = await window.fetch(
      'https://example.com/al_loader_part_configs.php?act=load_legacy',
    );
    expect((await external.json()).pe['frontend.audio_ads_config_api']).toBe(1);

    update({ block_ads_feature_flags: false });
    const disabled = await window.fetch(
      'https://vk.ru/al_loader_part_configs.php?act=load_legacy',
    );
    expect((await disabled.json()).pe['frontend.audio_ads_config_api']).toBe(1);
  });
});
