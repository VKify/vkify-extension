// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import i18next from 'i18next';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ru from '@/locales/ru/center.json';
import { sendMessage } from '@/shared/messaging.js';
import MediaUpload from './MediaUpload.js';
import { UPLOAD_LIMITS } from '@/shared/upload-policy.js';

const translator = i18next.createInstance();
void translator.init({ lng: 'ru', resources: { ru: { translation: ru } }, initImmediate: false });
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => translator.t(key, values) }) }));
vi.mock('@/shared/messaging.js', () => ({ sendMessage: vi.fn() }));
vi.mock('@/popup/components/ui/FormControls.js', () => ({
  Input: ({ icon: _icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode }) => <input {...props} />,
  Select: ({ icon: _icon, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { icon?: React.ReactNode }) => <select {...props} />,
}));

class PhotoTransfer {
  responseType = ''; timeout = 0; status = 200; response = { server: 1, hash: 'signed', photos_list: '[{"photo":"accepted"}]' };
  upload = {}; onload?: () => void; onabort?: () => void;
  open() {}
  send() { queueMicrotask(() => this.onload?.()); }
  abort() { this.onabort?.(); }
}
let root: Root, container: HTMLDivElement, now = Date.UTC(2080, 0, 1);
const send = vi.mocked(sendMessage);
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(now += 60000); send.mockReset();
  vi.stubGlobal('XMLHttpRequest', PhotoTransfer); Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
const selectFiles = async (files: File[]) => {
  const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { configurable: true, value: files });
  await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
};
const mount = async (kind: 'photo' | 'video' | 'doc') => {
  await act(async () => root.render(<MediaUpload kind={kind} ownerId="1" albums={[{ id: 9, title: 'Album' }]} disabled={false} onBusyChange={() => {}} onUploaded={() => {}} />));
};

it('reports two saved photos, the rate-limited third file and two unstarted files without losing them', async () => {
  const calls: number[] = []; let saved = 0;
  send.mockImplementation(async message => {
    calls.push(Date.now());
    if (message.type !== 'VK_API_CALL') return { success: false };
    if (message.method === 'photos.getUploadServer') return { success: true, data: { upload_url: 'https://pu.vk.ru/upload' } };
    return ++saved === 3 ? { success: false, code: '6', error: 'Too many requests' } : { success: true, data: [{ id: saved }] };
  });
  await mount('photo');
  await selectFiles(Array.from({ length: 5 }, (_, i) => new File(['photo'], `photo-${i + 1}.png`, { type: 'image/png' })));
  const album = container.querySelector('select')!;
  await act(async () => { album.value = '9'; album.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => container.querySelector<HTMLButtonElement>('.media-upload-footer button')!.click());
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(container.textContent).toContain('Успешно загружено: 2.');
  expect(container.textContent).toContain('photo-3.png'); expect(container.textContent).toContain('(6)');
  expect(container.textContent).toContain('Сохранено: 2 · С ошибкой: 1 · Не начато: 2.');
  expect(container.querySelectorAll('.media-upload-files li')).toHaveLength(3);
  expect(saved).toBe(3); expect(calls.every((time, i) => i === 0 || time - calls[i - 1] >= 1100)).toBe(true);
});
it('uploads all five photos sequentially with pauses', async () => {
  let saved = 0;
  send.mockImplementation(async message => message.type === 'VK_API_CALL' && message.method === 'photos.getUploadServer'
    ? { success: true, data: { upload_url: 'https://pu.vk.ru/upload' } } : { success: true, data: [{ id: ++saved }] });
  await mount('photo');
  await selectFiles(Array.from({ length: 5 }, (_, i) => new File(['photo'], `photo-${i + 1}.png`, { type: 'image/png' })));
  const album = container.querySelector('select')!;
  await act(async () => { album.value = '9'; album.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => container.querySelector<HTMLButtonElement>('.media-upload-footer button')!.click());
  await act(async () => { await vi.advanceTimersByTimeAsync(40000); });
  expect(saved).toBe(5); expect(container.textContent).toContain('Успешно загружено: 5.');
  expect(container.querySelectorAll('.media-upload-files li')).toHaveLength(0); expect(container.querySelector('[role=alert]')).toBeNull();
});
it('recovers from an empty photo receipt and displays the retry without counting it as another saved photo', async () => {
  let transfers = 0, saved = 0;
  class FlakyTransfer extends PhotoTransfer {
    send() { if (++transfers === 1) this.response.photos_list = '[]'; super.send(); }
  }
  vi.stubGlobal('XMLHttpRequest', FlakyTransfer);
  send.mockImplementation(async message => message.type === 'VK_API_CALL' && message.method === 'photos.getUploadServer'
    ? { success: true, data: { upload_url: 'https://pu.vk.ru/upload' } } : { success: true, data: [{ id: ++saved }] });
  await mount('photo');
  await selectFiles([new File(['photo'], 'wallhaven-qrg817.jpg', { type: 'image/jpeg' })]);
  const album = container.querySelector('select')!;
  await act(async () => { album.value = '9'; album.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => container.querySelector<HTMLButtonElement>('.media-upload-footer button')!.click());
  expect(container.textContent).toContain('Повторная загрузка: попытка 2 из 3.');
  expect(saved).toBe(0); expect(container.querySelector('[role=alert]')).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(transfers).toBe(2); expect(saved).toBe(1);
  expect(container.textContent).toContain('Успешно загружено: 1.');
  expect(container.querySelectorAll('.media-upload-files li')).toHaveLength(0);
  expect(container.querySelector('[role=alert]')).toBeNull();
});
it('shows the failing method and original VK explanation for code 100', async () => {
  send.mockImplementation(async message => message.type === 'VK_API_CALL' && message.method === 'photos.getUploadServer'
    ? { success: true, data: { upload_url: 'https://pu.vk.ru/upload' } }
    : { success: false, code: '100', error: 'One of the parameters specified was missing or invalid: photos_list is invalid' });
  await mount('photo');
  await selectFiles([new File(['photo'], 'wallhaven-6lpkl7.jpg', { type: 'image/jpeg' })]);
  const album = container.querySelector('select')!;
  await act(async () => { album.value = '9'; album.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => container.querySelector<HTMLButtonElement>('.media-upload-footer button')!.click());
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  const error = container.querySelector('[role=alert]')?.textContent;
  expect(error).toContain('photos.save: (100): One of the parameters');
  expect(error).toContain('photos_list is invalid');
  expect(error).not.toContain('Проверьте его размер');
  expect(container.querySelectorAll('.media-upload-files li')).toHaveLength(1);
});
it('cancels the pause after one photo without starting the second', async () => {
  let saved = 0;
  send.mockImplementation(async message => message.type === 'VK_API_CALL' && message.method === 'photos.getUploadServer'
    ? { success: true, data: { upload_url: 'https://pu.vk.ru/upload' } } : { success: true, data: [{ id: ++saved }] });
  await mount('photo');
  await selectFiles([new File(['photo'], 'one.png'), new File(['photo'], 'two.png')]);
  const album = container.querySelector('select')!;
  await act(async () => { album.value = '9'; album.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(async () => container.querySelector<HTMLButtonElement>('.media-upload-footer button')!.click());
  await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
  expect(saved).toBe(1);
  await act(async () => container.querySelector<HTMLButtonElement>('.media-upload-progress button')!.click());
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(saved).toBe(1); expect(send).toHaveBeenCalledTimes(2);
  expect(container.querySelectorAll('.media-upload-files li')).toHaveLength(1);
  expect(container.textContent).toContain('Сохранено: 1 · С ошибкой: 0 · Не начато: 1.');
});
it.each(['photo', 'video', 'doc'] as const)('blocks an excessive %s selection before any API call', async kind => {
  await mount(kind);
  await selectFiles(Array.from({ length: UPLOAD_LIMITS[kind].files + 1 }, (_, i) => new File(['bytes'], `file-${i}.${kind === 'photo' ? 'png' : kind === 'video' ? 'mp4' : 'txt'}`)));
  expect(container.querySelector<HTMLButtonElement>('.media-upload-footer button')!.disabled).toBe(true);
  expect(container.querySelector('[role=alert]')?.textContent).toContain('Уберите лишние'); expect(send).not.toHaveBeenCalled();
});
