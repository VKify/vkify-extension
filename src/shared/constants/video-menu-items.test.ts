import { describe, expect, it } from 'vitest';
import { VIDEO_MENU_IDS, VIDEO_MENU_ITEMS, isVideoMenuSelection, normalizeVideoMenuOrder } from './video-menu-items.js';

describe('VK Video sidebar catalog', () => {
  it('starts defaults and reset with the current native main and personal groups', () => {
    const expected = ['main_menu_trends', 'main_menu_popular_trends', 'main_menu_clips',
      'main_menu_for_kids', 'main_menu_vk_live', 'sep_video_personal',
      'main_menu_my_history', 'main_menu_my_bookmarks', 'main_menu_my_liked',
      'main_menu_my_playlists', 'main_menu_authors_cabinet', 'sep_video_categories',
      'main_menu_politics', 'main_menu_movies_and_serials'];
    expect(normalizeVideoMenuOrder([]).slice(0, expected.length)).toEqual(expected);
    expect(normalizeVideoMenuOrder(undefined).slice(0, expected.length)).toEqual(expected);
    expect(VIDEO_MENU_ITEMS.filter(item => item.group === 'main').map(item => item.id)).toEqual(expected.slice(0, 5));
  });
  it('covers the signed-in menu with unique IDs and selectors independent of CSS class hashes', () => {
    expect(VIDEO_MENU_ITEMS).toHaveLength(33);
    expect(VIDEO_MENU_ITEMS.map(item => item.id)).toEqual(VIDEO_MENU_IDS);
    expect(new Set(VIDEO_MENU_IDS).size).toBe(VIDEO_MENU_IDS.length);
    expect(VIDEO_MENU_ITEMS.every(item => item.before || item.selector.includes('data-testid') || item.selector.includes('href='))).toBe(true);
    expect(VIDEO_MENU_IDS).toEqual(expect.arrayContaining(['main_menu_my_history', 'main_menu_my_bookmarks',
      'main_menu_my_liked', 'main_menu_my_playlists', 'main_menu_authors_cabinet', 'main_menu_sport',
      'main_menu_serial', 'main_menu_lives', 'main_menu_cybersport', 'main_menu_family_values',
      'main_menu_video_subscriptions_select', 'main-menu-content-info', 'main_menu_legal_info']));
  });
  it('normalizes saved order without losing new items or accepting arbitrary IDs', () => {
    const saved = ['main_menu_clips', 'sep_video_info', 'main_menu_clips', 'body'];
    const order = normalizeVideoMenuOrder(saved);
    expect(order.slice(0, 2)).toEqual(['main_menu_clips', 'sep_video_info']);
    expect(new Set(order).size).toBe(VIDEO_MENU_IDS.length);
    expect(order).not.toContain('body');
    expect(normalizeVideoMenuOrder(null)).toEqual(VIDEO_MENU_IDS);
    expect(saved).toEqual(['main_menu_clips', 'sep_video_info', 'main_menu_clips', 'body']);
  });
  it('preserves old preferences, accepts new items and rejects arbitrary selectors or user-specific author IDs', () => {
    expect(isVideoMenuSelection(['main_menu_clips'])).toBe(true);
    expect(isVideoMenuSelection([...VIDEO_MENU_IDS])).toBe(true);
    for (const value of [['body'], ['main_menu_block_111'], ['main_menu_clips', 'main_menu_clips'], 'main_menu_clips']) {
      expect(isVideoMenuSelection(value)).toBe(false);
    }
  });
});
