import { prepareBackground } from '../../shared/prepare-background.js';
import { storage } from '../core/storage.js';
import { decodeThemeSettings } from '../../shared/theme-payload.js';
import { buildThemePatch } from '../../shared/constants/appearance.js';
import { createFloatingCard } from '../ui/floating-card.js';
import { getLang } from '../i18n/index.js';

/** Preview is local to this tab. Only an explicit Apply persists the patch. */
export async function previewSharedTheme(sourceUrl = location.href): Promise<(() => void) | undefined> {
  const url = new URL(sourceUrl);
  const encoded = url.searchParams.get('vkify_theme');
  if (!encoded || !/(^|\.)vk\.(ru|com)$/.test(url.hostname)) return;
  let patch: Record<string, unknown>;
  try { patch = buildThemePatch(decodeThemeSettings(encoded)); }
  catch { return; }
  patch = await prepareBackground(patch);
  await storage.setPreview(patch);
  url.searchParams.delete('vkify_theme');
  if (location.href === sourceUrl) history.replaceState(history.state, '', url.toString());
  const en = getLang() === 'en';
  const card = createFloatingCard({ title: en ? 'Theme preview' : 'Предпросмотр темы' });
  card.root.id = 'vkify-theme-preview';
  card.root.setAttribute('role', 'dialog');
  card.root.setAttribute('aria-label', en ? 'Theme preview' : 'Предпросмотр темы');
  card.root.style.cssText = 'position:fixed;z-index:2147483647;right:24px;top:80px;width:340px;max-width:calc(100vw - 32px)';
  const text = document.createElement('p');
  text.textContent = en ? 'This theme is only visible in this tab. Apply it to save your appearance?' : 'Тема временно показана только в этой вкладке. Применить и сохранить оформление?';
  text.style.cssText = 'margin:8px;font-size:13px;line-height:1.5';
  const apply = document.createElement('button');
  const cancel = document.createElement('button');
  apply.type = cancel.type = 'button';
  apply.className = cancel.className = 'vkify-card__item';
  apply.textContent = en ? 'Apply theme' : 'Применить тему';
  cancel.textContent = en ? 'Cancel' : 'Отмена';
  const close = (): void => {
    card.root.remove();
    document.removeEventListener('keydown', keydown);
    void storage.setPreview({});
  };
  const keydown = (event: KeyboardEvent): void => { if (event.key === 'Escape') close(); };
  apply.onclick = () => {
    apply.disabled = cancel.disabled = true;
    void storage.setMultiple(patch).then(success => {
      if (success) close();
      else throw new Error('Save failed');
    }).catch(() => {
      text.textContent = en ? 'Could not save the theme. Please try again.' : 'Не удалось сохранить тему. Попробуйте ещё раз.';
      apply.disabled = cancel.disabled = false;
    });
  };
  cancel.onclick = close;
  card.list.append(text, apply, cancel);
  document.body.append(card.root);
  cancel.focus({ preventScroll: true });
  document.addEventListener('keydown', keydown);
  return close;
}
