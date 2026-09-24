// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import FriendsPage from './FriendsPage.js';
import FriendsAuditPage from './FriendsAuditPage.js';
import { useFriendsAudit } from '@/popup/hooks/features/useFriendsAudit.js';
import { activityBucket } from './friendsView.js';
import { isNonUiStateKey } from '@/popup/store/keys.js';
import en from '@/locales/en/center.json';

vi.mock('@/popup/components/ui/DocsLink.js', () => ({ default: () => null }));
vi.mock('@/popup/hooks/core/useVKApi.js', () => ({ useVKApi: () => ({ userId: '1', isReady: true, loading: false }) }));
vi.mock('@/popup/hooks/features/useFriendsAudit.js', () => ({ useFriendsAudit: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, params: Record<string, unknown> = {}) => {
    let value: unknown = en;
    for (const part of key.split('.')) value = (value as Record<string, unknown>)?.[part];
    return String(value ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params[name] ?? ''));
  }, i18n: { language: 'en' },
}) }));

let root: Root;
const refresh = vi.fn();
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.mocked(useFriendsAudit).mockReset().mockReturnValue({
    snapshot: { version: 2, userId: '1', fetchedAt: Date.now(), friends: [
      { id: 1, name: 'Alice Old', online: false, noAvatar: false, lastSeen: 1000000 },
      { id: 2, name: 'Bob Hidden', online: false, noAvatar: true },
      { id: 3, name: 'Chris Online', online: true, noAvatar: false },
    ], incoming: [{ id: 4, name: 'Dana Incoming', online: false, noAvatar: true }], outgoing: [] },
    loading: false, error: null, cacheFailed: false, progress: null, refresh,
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; });
const render = async (component = FriendsAuditPage) => { await act(async () => root.render(React.createElement(component))); };
const names = () => [...document.querySelectorAll('.fa-name strong')].map(node => node.textContent);
const click = async (selector: string) => { await act(async () => (document.querySelector(selector) as HTMLElement).click()); };

it('opens the analytics directly from a navigation row, without a switch', async () => {
  await render(FriendsPage);
  expect(useFriendsAudit).not.toHaveBeenCalled();
  expect(document.querySelector('[role="switch"]')).toBeNull();
  const open = [...document.querySelectorAll('button')].find(button => button.textContent?.includes('Friends audit'))!;
  await act(async () => open.click());
  expect(document.querySelector('.friends-audit')).not.toBeNull();
  await click('header button');
  expect(document.querySelector('.friends-audit')).toBeNull();
  expect(isNonUiStateKey('friends_audit_v2_1')).toBe(true);
});

it('filters through metrics and histogram, switches requests, and resets filters', async () => {
  await render();
  await click('.fa-summary button:nth-child(2)');
  expect(names()).toEqual(['Alice Old']);
  await click('.fa-bucket-unknown');
  expect(names()).toEqual(['Bob Hidden']);
  await click('.fa-segments button:nth-child(2)');
  expect(names()).toEqual(['Dana Incoming']);
  await click('.fa-summary button:first-child');
  expect(names()).toHaveLength(3);
  await click('.ds-list-options input');
  expect(document.querySelectorAll('.fa-profile.is-compact')).toHaveLength(3);
  await click('[aria-label="Refresh"]');
  expect(refresh).toHaveBeenCalled();
});

it('counts unknown dates visibly and can include them in results without claiming inactivity', async () => {
  await render();
  expect(document.querySelector('.fa-unknown-card strong')?.textContent).toBe('1');
  await click('.fa-unknown-card');
  expect(names()).toEqual(['Bob Hidden']);
  await click('.fa-summary button:nth-child(2)');
  await click('.fa-known input');
  expect(names()).toEqual(['Alice Old', 'Bob Hidden']);
  expect(document.querySelector('.fa-summary button:nth-child(2) strong')?.textContent).toBe('1');
  const unknown = [...document.querySelectorAll('.fa-profile')].find(node => node.textContent?.includes('Bob Hidden'))!;
  expect(unknown.textContent).not.toContain('Inactive');
});

it('shows unavailable request counts as unknown, retaining usable friends', async () => {
  const current = vi.mocked(useFriendsAudit)('1', true);
  vi.mocked(useFriendsAudit).mockReturnValue({ ...current, snapshot: { ...current.snapshot!, incoming: [], requestErrors: { incoming: 'Denied' } } });
  await render();
  expect(names()).toHaveLength(3);
  expect(document.querySelector('.fa-summary button:nth-child(5) strong')?.textContent).toBe('—');
  await click('.fa-segments button:nth-child(2)');
  expect(document.body.textContent).toContain('Requests could not be loaded');
  expect(document.body.textContent).not.toContain('No profiles found');
});

it('does not show zero totals before a snapshot exists', async () => {
  const result = vi.mocked(useFriendsAudit)('1', true);
  vi.mocked(useFriendsAudit).mockReturnValue({ ...result, snapshot: null, loading: true });
  await render();
  expect([...document.querySelectorAll('.ds-metric strong')].map(node => node.textContent)).toEqual(Array(7).fill('—'));
  expect((document.querySelector('[aria-label="Refresh"]') as HTMLButtonElement).disabled).toBe(true);
  expect(document.querySelector('progress')).not.toBeNull();
});

it('groups activity on exact boundaries without counting online users as unknown', () => {
  const user = { id: 1, name: 'Test', online: false, noAvatar: false };
  const now = Date.now();
  expect(activityBucket(user, now)).toBe('unknown');
  expect(activityBucket({ ...user, online: true }, now)).toBe('recent');
  for (const [days, bucket] of [[89, 'recent'], [90, 'halfYear'], [180, 'year'], [365, 'older']] as const) {
    expect(activityBucket({ ...user, lastSeen: (now - days * 86400000) / 1000 }, now)).toBe(bucket);
  }
});
