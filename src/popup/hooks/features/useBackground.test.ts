// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { useBackground, type BackgroundHook } from './useBackground.js';
import { useVKifyStore } from '../../store/index.js';

vi.mock('../../context/ToastContext.js', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('@/popup/i18n.js', () => ({ default: { t: (key: string) => key } }));
vi.mock('../../store/index.js', async () => {
  const { create } = await import('zustand');
  return { useVKifyStore: create(() => ({ settings: {}, saveMultiple: vi.fn() })) };
});

const initialState = useVKifyStore.getState();
afterEach(() => { useVKifyStore.setState(initialState, true); });

it('returns the content hook to presets when the separate header hook resets the background', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const saveMultiple = vi.fn(async (updates: Record<string, unknown>) => {
    useVKifyStore.setState(state => ({ settings: { ...state.settings, ...updates } }));
    return true;
  });
  useVKifyStore.setState({
    settings: { custom_background: 'https://example.com/wallpaper.png', background_type: 'image' },
    saveMultiple,
  });
  let content!: BackgroundHook;
  let header!: BackgroundHook;
  function Harness() {
    content = useBackground();
    header = useBackground();
    return null;
  }
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    await act(async () => root.render(React.createElement(Harness)));
    await act(async () => content.setActiveTab('settings'));
    expect(content.activeTab).toBe('settings');
    expect(header.activeTab).toBe('presets');
    await act(async () => header.clearBackground());
    expect(content.hasBackground).toBe(false);
    expect(content.activeTab).toBe('presets');

    // Resetting externally also preserves an unfinished custom upload.
    await act(async () => content.setActiveTab('custom'));
    await act(async () => header.clearBackground());
    expect(content.activeTab).toBe('custom');
  } finally {
    await act(async () => root.unmount());
  }
});
