import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProtectionRegistration } from './protection-registration.js';
import { PROTECTION_MAIN_ID, protectionSettingFile } from '@/shared/constants/protection-startup.js';

let settings: Record<string, unknown>;
let registered: chrome.scripting.RegisteredContentScript[];
const register = vi.fn(async (scripts: chrome.scripting.RegisteredContentScript[]) => { registered.push(...scripts); });
const update = vi.fn(async (scripts: chrome.scripting.RegisteredContentScript[]) => {
  registered = registered.map(script => scripts.find(next => next.id === script.id) ?? script);
});
beforeEach(() => {
  settings = {}; registered = []; vi.clearAllMocks();
  vi.stubGlobal('chrome', { runtime: {}, storage: { local: { get: vi.fn(async () => ({ ...settings })) } }, scripting: {
    getRegisteredContentScripts: vi.fn(async () => registered), registerContentScripts: register, updateContentScripts: update,
  } });
});
afterEach(() => vi.unstubAllGlobals());

it('registers configured filters in MAIN at document_start and the collector in all matching frames', async () => {
  settings = { block_trackers: false };
  await new ProtectionRegistration().refresh();
  expect(registered).toHaveLength(2);
  const main = registered.find(script => script.id === PROTECTION_MAIN_ID)!;
  expect(main).toMatchObject({ world: 'MAIN', runAt: 'document_start', allFrames: true, persistAcrossSessions: true });
  expect(main.js![0]).toBe('injected/protection-settings.js');
  expect(main.js![main.js!.length - 1]).toBe('injected/protection-native.js');
  expect(main.js).not.toContain(protectionSettingFile('block_trackers'));
  expect(main.js).toContain(protectionSettingFile('block_feed_ads_api'));
  expect(main.js).not.toContain(protectionSettingFile('hide_recent_groups'));
  expect(registered.find(script => script.world === 'ISOLATED')).toMatchObject({ js: ['protection-relay.js'], allFrames: true });
});

it('updates existing declarations atomically and keeps the newest setting across queued refreshes', async () => {
  const service = new ProtectionRegistration();
  await service.refresh();
  settings.block_trackers = false;
  const first = service.refresh();
  settings.block_trackers = true;
  const second = service.refresh();
  await Promise.all([first, second]);
  expect(registered.find(script => script.id === PROTECTION_MAIN_ID)!.js).toContain(protectionSettingFile('block_trackers'));
  expect(register).toHaveBeenCalledOnce();
  settings.block_trackers = false;
  await service.refresh();
  expect(update).toHaveBeenCalledOnce();
  expect(registered.find(script => script.id === PROTECTION_MAIN_ID)!.js).not.toContain(protectionSettingFile('block_trackers'));
  await service.refresh();
  expect(update).toHaveBeenCalledOnce();
});

it('retries after a failed registration without poisoning the refresh queue', async () => {
  register.mockRejectedValueOnce(new Error('temporary failure'));
  const service = new ProtectionRegistration();
  await expect(service.refresh()).rejects.toThrow('temporary failure');
  await service.refresh();
  expect(registered).toHaveLength(2);
});

it('keeps the existing fallback on Firefox versions without MAIN registration', async () => {
  Object.assign(chrome.runtime, { getBrowserInfo: async () => ({ version: '115.0' }) });
  await new ProtectionRegistration().refresh();
  expect(register).not.toHaveBeenCalled();
});
