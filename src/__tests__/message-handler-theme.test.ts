import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageHandler } from '../background/handlers/message-handler.js';


/** Encode a theme payload to the URL-safe base64 format that handleApplySharedTheme expects. */
function encodeTheme(p: Record<string, unknown>): string {
  const json = JSON.stringify({ p });
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}


const mockStorageSet = vi.fn().mockResolvedValue(undefined);

vi.stubGlobal('chrome', {
  storage: { local: { set: mockStorageSet, get: vi.fn().mockResolvedValue({}) } },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
  runtime: { sendMessage: vi.fn().mockResolvedValue(undefined) },
});

vi.mock('../background/utils/tabs.js', () => ({
  TabsHelper: {
    notifyAllVKTabs: vi.fn().mockResolvedValue(undefined),
    sendToActiveVKTab: vi.fn().mockResolvedValue(undefined),
    hasVKTabs: vi.fn().mockResolvedValue(false),
    notifyPopup: vi.fn().mockResolvedValue(undefined),
  },
}));

function makeHandler(): MessageHandler {
  return new MessageHandler(
    {} as never,   // SpyTracker — not used by handleApplySharedTheme
    {} as never,   // ProfileTracker — not used by handleApplySharedTheme
    {} as never,   // AlarmManager
    {} as never,   // NotificationService
    {} as never,   // VKTokenManager
  );
}


describe('MessageHandler.handleApplySharedTheme — sanity checks', () => {
  beforeEach(() => {
    mockStorageSet.mockClear();
  });

  it('применяет валидный payload с разрешёнными ключами', async () => {
    const handler = makeHandler();
    const encoded = encodeTheme({ custom_theme: 'dark', block_opacity: 0.8 });

    const result = await handler.handleApplySharedTheme(encoded);

    expect(result).toMatchObject({ success: true });
    expect((result as { applied: string[] }).applied).toContain('custom_theme');
    expect((result as { applied: string[] }).applied).toContain('block_opacity');
    expect(mockStorageSet).toHaveBeenCalledWith({ custom_theme: 'dark', block_opacity: 0.8 });
  });

  it('возвращает ошибку при пустой строке', async () => {
    const result = await makeHandler().handleApplySharedTheme('');
    expect(result).toMatchObject({ success: false });
  });

  it('возвращает ошибку при невалидном base64', async () => {
    const result = await makeHandler().handleApplySharedTheme('!!!not-base64!!!');
    expect(result).toMatchObject({ success: false });
  });

  it('возвращает ошибку при валидном base64 но невалидном JSON', async () => {
    const badJson = btoa('not json at all');
    const result = await makeHandler().handleApplySharedTheme(badJson);
    expect(result).toMatchObject({ success: false });
  });

  it('возвращает ошибку если в payload нет поля p', async () => {
    const json = JSON.stringify({ other: 'stuff' });
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const noP = btoa(binary);
    const result = await makeHandler().handleApplySharedTheme(noP);
    expect(result).toMatchObject({ success: false });
  });
});

describe('MessageHandler.handleApplySharedTheme — фильтрация ключей (whitelist)', () => {
  beforeEach(() => { mockStorageSet.mockClear(); });

  it('фильтрует ключи не из THEME_KEY_SCHEMA', async () => {
    const encoded = encodeTheme({
      custom_theme: 'dark',
      __proto__: 'injected',
      arbitrary_key: 'value',
      admin: true,
    });
    const result = await makeHandler().handleApplySharedTheme(encoded);

    expect(result).toMatchObject({ success: true });
    const applied = (result as { applied: string[] }).applied;
    expect(applied).toContain('custom_theme');
    expect(applied).not.toContain('__proto__');
    expect(applied).not.toContain('arbitrary_key');
    expect(applied).not.toContain('admin');
  });

  it('возвращает ошибку если ВСЕ ключи отфильтрованы', async () => {
    const encoded = encodeTheme({ evil_key: 'value', another_bad_key: 123 });
    const result = await makeHandler().handleApplySharedTheme(encoded);
    expect(result).toMatchObject({ success: false });
    expect(mockStorageSet).not.toHaveBeenCalled();
  });
});

describe('MessageHandler.handleApplySharedTheme — защита типов значений', () => {
  beforeEach(() => { mockStorageSet.mockClear(); });

  it('фильтрует строку в числовом поле (block_opacity)', async () => {
    const encoded = encodeTheme({ block_opacity: 'not-a-number', custom_theme: 'dark' });
    const result = await makeHandler().handleApplySharedTheme(encoded);

    const applied = (result as { applied: string[] }).applied;
    expect(applied).not.toContain('block_opacity');
    expect(applied).toContain('custom_theme');
  });

  it('фильтрует объект в числовом поле', async () => {
    const encoded = encodeTheme({ block_opacity: { __proto__: 'pwned' }, custom_theme: 'dark' });
    const result = await makeHandler().handleApplySharedTheme(encoded);

    expect((result as { applied: string[] }).applied).not.toContain('block_opacity');
  });

  it('фильтрует массив в строковом поле', async () => {
    const encoded = encodeTheme({ custom_theme: ['dark', 'light'], block_opacity: 0.5 });
    const result = await makeHandler().handleApplySharedTheme(encoded);

    expect((result as { applied: string[] }).applied).not.toContain('custom_theme');
    expect((result as { applied: string[] }).applied).toContain('block_opacity');
  });

  it('фильтрует число в булевом поле (filter_grayscale)', async () => {
    const encoded = encodeTheme({ filter_grayscale: 1, custom_theme: 'dark' });
    const result = await makeHandler().handleApplySharedTheme(encoded);

    expect((result as { applied: string[] }).applied).not.toContain('filter_grayscale');
  });

  it('принимает boolean в булевом поле', async () => {
    const encoded = encodeTheme({ filter_grayscale: true });
    const result = await makeHandler().handleApplySharedTheme(encoded);

    expect((result as { applied: string[] }).applied).toContain('filter_grayscale');
  });
});

describe('MessageHandler.handleApplySharedTheme — enum поле background_type', () => {
  beforeEach(() => { mockStorageSet.mockClear(); });

  it('принимает допустимое значение enum: image', async () => {
    const encoded = encodeTheme({ background_type: 'image' });
    const result = await makeHandler().handleApplySharedTheme(encoded);
    expect((result as { applied: string[] }).applied).toContain('background_type');
  });

  it('принимает допустимое значение enum: video', async () => {
    const encoded = encodeTheme({ background_type: 'video' });
    const result = await makeHandler().handleApplySharedTheme(encoded);
    expect((result as { applied: string[] }).applied).toContain('background_type');
  });

  it('принимает допустимые значения enum: embed и web', async () => {
    for (const val of ['embed', 'web']) {
      const encoded = encodeTheme({ background_type: val });
      const result = await makeHandler().handleApplySharedTheme(encoded);
      expect((result as { applied: string[] }).applied).toContain('background_type');
    }
  });

  it('фильтрует недопустимое значение enum: произвольная строка', async () => {
    const encoded = encodeTheme({ background_type: 'javascript:alert(1)', custom_theme: 'dark' });
    const result = await makeHandler().handleApplySharedTheme(encoded);
    expect((result as { applied: string[] }).applied).not.toContain('background_type');
  });

  it('фильтрует недопустимое значение enum: объект', async () => {
    const encoded = encodeTheme({ background_type: { url: 'evil.com' }, custom_theme: 'dark' });
    const result = await makeHandler().handleApplySharedTheme(encoded);
    expect((result as { applied: string[] }).applied).not.toContain('background_type');
  });
});

describe('MessageHandler.handleApplySharedTheme — полная тема', () => {
  it('применяет 5 допустимых ключей одновременно', async () => {
    const encoded = encodeTheme({
      custom_theme: 'dark',
      block_opacity: 0.85,
      border_radius: 12,
      filter_grayscale: false,
      background_type: 'image',
    });

    const result = await makeHandler().handleApplySharedTheme(encoded);
    expect(result).toMatchObject({ success: true });
    expect((result as { applied: string[] }).applied).toHaveLength(5);
    expect(mockStorageSet).toHaveBeenCalledWith({
      custom_theme: 'dark',
      block_opacity: 0.85,
      border_radius: 12,
      filter_grayscale: false,
      background_type: 'image',
    });
  });
});