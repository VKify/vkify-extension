import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewColor, cancelColorPreview, getColorPreviewRevision } from './livePreview.js';
import { sendMessage } from '@/shared/messaging.js';
import { previewPopupTheme } from './themePalette.js';

vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn(async () => ({})) }));
vi.mock('@/popup/store/index.js', () => ({ useVKifyStore: { getState: () => ({ settings: {} }) } }));
vi.mock('./themePalette.js', () => ({ previewPopupTheme: vi.fn() }));
afterEach(() => { cancelColorPreview(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('theme preview cancellation', () => {
  it('cancels queued previews and invalidates delayed color commits on preset or reset', () => {
    vi.useFakeTimers();
    const pendingCommitRevision = getColorPreviewRevision();
    previewColor('custom_theme_preview', '#172a3d'); previewColor('custom_accent_preview', '#ef1234');
    cancelColorPreview(); vi.runAllTimers();
    expect(getColorPreviewRevision()).not.toBe(pendingCommitRevision);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(previewPopupTheme).not.toHaveBeenCalled();
  });
  it('lets subsequent previews run after cancellation', () => {
    vi.useFakeTimers();
    cancelColorPreview(); previewColor('custom_accent_preview', '#123456'); vi.runAllTimers();
    expect(sendMessage).toHaveBeenCalledOnce();
    expect(previewPopupTheme).toHaveBeenCalledWith(null, '#123456');
  });
});
