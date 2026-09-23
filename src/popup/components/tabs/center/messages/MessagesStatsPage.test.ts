// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import MessagesStatsPage from './MessagesStatsPage.js';
import { useDialogStats } from '@/popup/hooks/features/useDialogStats.js';
import { emptyDialogStats, type DialogStat } from '@/shared/dialog-stats.js';
import { downloadText } from '@/shared/utils/download.js';

vi.mock('@/popup/hooks/features/useDialogStats.js', () => ({ useDialogStats: vi.fn() }));
vi.mock('@/shared/utils/download.js', () => ({ downloadText: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { resolvedLanguage: 'en' } }) }));

let root: Root;
const action = vi.fn();
const makeRow = (peerId: number, count: number, days: number, direction: 'in' | 'out'): DialogStat => ({
  peerId, title: `Dialog ${peerId}`, type: 'user', lastMessageAt: Date.now() - days * 86400000,
  lastDirection: direction, approxMessageCount: count, countExact: false, unread: 0,
});
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  action.mockReset();
  vi.mocked(downloadText).mockReset();
  vi.mocked(useDialogStats).mockReturnValue({
    state: { ...emptyDialogStats('1'), status: 'completed', collectedAt: Date.now(),
      rows: [makeRow(1, 100, 10, 'in'), makeRow(2, 500, 100, 'out'), { ...makeRow(-3, 300, 70, 'in'), type: 'group' }] },
    error: undefined, pending: false, action,
  });
  const host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(React.createElement(MessagesStatsPage)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = '';
});
const titles = () => [...document.querySelectorAll('.ds-name strong')].map(a => a.textContent?.trim());
async function select(label: string, value: string) {
  const element = document.querySelector(`select[aria-label="stats.${label}"]`) as HTMLSelectElement;
  await act(async () => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function click(key: string) {
  const button = [...document.querySelectorAll('button')].find(node => node.textContent === `stats.${key}` || node.getAttribute('aria-label') === `stats.${key}`)!;
  expect(button).toBeTruthy();
  await act(async () => button.click());
}

it('sorts by count and inactivity, filters dead dialogs and restricts reply filters to personal dialogs', async () => {
  expect(titles()).toEqual(['Dialog 2', 'Dialog -3', 'Dialog 1']);
  await select('sort', 'date');
  expect(titles()).toEqual(['Dialog 1', 'Dialog -3', 'Dialog 2']);
  await select('filter', 'dead');
  expect(titles()).toEqual(['Dialog 2']);
  await select('filter', 'in');
  expect(titles()).toEqual(['Dialog 1']);
  await select('filter', 'group');
  expect(titles()).toEqual(['Dialog -3']);
});

it('only refines the currently filtered list after an explicit button click', async () => {
  await select('filter', 'dead');
  await click('exact');
  expect(action).not.toHaveBeenCalled();
  await click('refine');
  expect(action).toHaveBeenCalledWith('exact', [2]);
  await click('refresh');
  expect(action).toHaveBeenLastCalledWith('refresh');
});

it('offers cancellation and prevents starting a second running job', async () => {
  const current = vi.mocked(useDialogStats).mock.results[0].value;
  vi.mocked(useDialogStats).mockReturnValue({ ...current, state: { ...current.state, status: 'running' } });
  await act(async () => root.render(React.createElement(MessagesStatsPage)));
  const refresh = document.querySelector('[aria-label="stats.refresh"]') as HTMLButtonElement;
  expect(refresh.disabled).toBe(true);
  await click('cancel');
  expect(action).toHaveBeenCalledWith('cancel');
});

it('uses selected dialogs for refinement and CSV even when they are hidden by filters', async () => {
  const box = document.querySelector('.ds-dialog input') as HTMLInputElement;
  await act(async () => box.click());
  await select('filter', 'in');
  await click('exact');
  await click('refine_selected');
  expect(action).toHaveBeenCalledWith('exact', [2]);
  await click('export_selected');
  const csv = vi.mocked(downloadText).mock.calls[0][0];
  expect(csv).toContain('Dialog 2');
  expect(csv).not.toContain('Dialog 1');
  await click('clear_selection');
  await click('export_csv');
  expect(vi.mocked(downloadText).mock.calls[1][0]).toContain('Dialog 1');
});

it('filters by activity histogram and resets the filters', async () => {
  const bucket = document.querySelector('.ds-bucket-quarter') as HTMLButtonElement;
  await act(async () => bucket.click());
  expect(titles()).toEqual(['Dialog -3']);
  await click('reset_filters');
  expect(titles()).toHaveLength(3);
});

it('does not carry selection into another account', async () => {
  await click('select_page');
  const current = vi.mocked(useDialogStats).mock.results[0].value;
  vi.mocked(useDialogStats).mockReturnValue({ ...current, state: { ...current.state, ownerId: '2' } });
  await act(async () => root.render(React.createElement(MessagesStatsPage)));
  expect([...document.querySelectorAll<HTMLInputElement>('.ds-dialog input')].every(box => !box.checked)).toBe(true);
});

it('limits cross-page selection to 20 and allows deselecting at the limit', async () => {
  const current = vi.mocked(useDialogStats).mock.results[0].value;
  vi.mocked(useDialogStats).mockReturnValue({ ...current, state: { ...current.state,
    rows: Array.from({ length: 21 }, (_, index) => makeRow(index + 1, index + 1, 0, 'in')) } });
  await act(async () => root.render(React.createElement(MessagesStatsPage)));
  await click('select_page');
  expect(document.querySelector<HTMLInputElement>('.ds-dialog input')?.disabled).toBe(false);
  await click('next');
  expect(document.querySelector<HTMLInputElement>('.ds-dialog input')?.disabled).toBe(true);
  await click('exact');
  await click('refine_selected');
  expect(action.mock.calls[0][1]).toHaveLength(20);
});
