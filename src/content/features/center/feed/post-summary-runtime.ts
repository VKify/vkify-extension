import type { ScopedFeatureContext } from '@/content/core/features/scoped-context.js';
import { getLang } from '@/content/i18n/lang.js';
import { POST_SUMMARY_URL_LIMITS, postSummaryName, postSummaryPrompt, postSummaryUrl, type PostSummaryProvider, type PostSummaryInstructions } from '@/shared/post-summary.js';
import { POST_SUMMARY_LOGOS } from './post-summary-logos.js';
import { createSearchMenu } from '../photo/search-menu.js';

const POST = '[data-testid="post"], .post';
const TEXT = '[data-testid="showmoretext"], .wall_post_text, [class*="FeedPostText__root"], .pi_text';
function textElement(post: Element): HTMLElement | undefined {
  return [...post.querySelectorAll<HTMLElement>(TEXT)].find(el => el.closest(POST) === post);
}
export function postSummaryText(post: Element): string {
  const source = textElement(post);
  if (!source) return '';
  const copy = source.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[data-testid="showmoretext-after"], .PostTextMore, button, script, style, [data-vkify-post-summary]').forEach(el => el.remove());
  copy.querySelectorAll('img[alt]').forEach(el => el.replaceWith(document.createTextNode(el.getAttribute('alt')!)));
  copy.querySelectorAll('br').forEach(el => el.replaceWith(document.createTextNode('\n')));
  copy.querySelectorAll('p, div, li').forEach(el => el.append('\n'));
  return (copy.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function startPostSummary(ctx: ScopedFeatureContext, providers: PostSummaryProvider[], instructions: PostSummaryInstructions = {}): () => void {
  let alive = true;
  const ru = getLang() === 'ru';
  const label = ru ? 'Краткая сводка поста' : 'AI post summary';
  const bindings = new Map<HTMLElement, { row: HTMLElement; stop: () => void }>();
  let picker: ReturnType<typeof createSearchMenu> | null = null;
  let activePost: HTMLElement | null = null;
  let activeButton: HTMLButtonElement | null = null;
  const closePicker = (): void => { picker?.destroy(); picker = null; activePost = null; activeButton = null; };

  const showPicker = (post: HTMLElement, trigger: HTMLButtonElement, last = false): void => {
    if (activeButton === trigger && picker) { picker.toggle(last); return; }
    closePicker(); activePost = post; activeButton = trigger;
    const footer = document.createElement('div'); footer.className = 'vkify-summary-transfer';
    const items = providers.map(provider => {
      const name = postSummaryName(provider, getLang());
      const item = document.createElement('button'); item.type = 'button'; item.dataset.summaryProvider = provider;
      item.title = (ru ? 'Передать текст в ' : 'Send text to ') + name + (ru ? ' — новая вкладка' : ' — new tab');
      item.setAttribute('aria-label', (ru ? 'Сводка поста в ' : 'Summarize post with ') + name);
      const logo = document.createElement('img'); logo.src = POST_SUMMARY_LOGOS[provider]; logo.alt = '';
      item.append(logo, name);
      item.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (!alive || !post.isConnected) { closePicker(); return; }
        footer.replaceChildren();
        const status = document.createElement('div'); status.setAttribute('role', 'status');
        const text = postSummaryText(post);
        if (!text) { status.textContent = ru ? 'В посте нет текста для сводки.' : 'No post text to summarize.'; footer.append(status); return; }
        const prompt = postSummaryPrompt(text, getLang(), instructions[getLang()]);
        const url = postSummaryUrl(provider, prompt);
        if (url.length <= POST_SUMMARY_URL_LIMITS[provider]) { window.open(url, '_blank', 'noopener,noreferrer'); return; }
        const aliceFits = provider !== 'yandex' && providers.includes('yandex') && postSummaryUrl('yandex', prompt).length <= POST_SUMMARY_URL_LIMITS.yandex;
        status.textContent = ru
          ? `Текст слишком длинный для ссылки ${name}. ${aliceFits ? 'Выберите «Алиса AI» для прямой передачи. ' : ''}Скопируйте запрос и вставьте его в чат.`
          : `Text is too long for a ${name} link. ${aliceFits ? 'Choose Alice AI to send it directly. ' : ''}Copy the prompt and paste it into the chat.`;
        const field = document.createElement('textarea'); field.value = prompt; field.readOnly = true;
        field.setAttribute('aria-label', ru ? 'Полный запрос для ИИ' : 'Full AI prompt');
        const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = ru ? 'Скопировать запрос' : 'Copy prompt';
        copy.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          if (!alive || !post.isConnected) return;
          field.focus({ preventScroll: true }); field.select();
          let copied = false;
          try { copied = document.execCommand('copy'); } catch { /* Keep the full prompt selected for manual copying. */ }
          status.textContent = copied
            ? (ru ? 'Запрос скопирован целиком. Нажмите «Открыть чат» и вставьте его.' : 'Full prompt copied. Click Open chat and paste it.')
            : (ru ? 'Запрос выделен. Нажмите Ctrl/Cmd+C, затем откройте чат и вставьте текст.' : 'Prompt selected. Press Ctrl/Cmd+C, then open the chat and paste it.');
        });
        const open = document.createElement('a'); open.href = postSummaryUrl(provider); open.target = '_blank'; open.rel = 'noopener noreferrer';
        open.textContent = ru ? 'Открыть чат' : 'Open chat'; open.setAttribute('aria-label', (ru ? 'Открыть чат: ' : 'Open chat: ') + name);
        open.addEventListener('click', event => event.stopPropagation());
        footer.append(status, field, copy, open);
      });
      return item;
    });
    picker = createSearchMenu(label, items, { trigger, id: 'vkify-post-summary-popup', className: 'vkify-summary-popup', footer, closeOnSelect: () => !footer.hasChildNodes() });
    picker.toggle(last);
  };

  if (providers.length) ctx.registerMutationObserver(POST, element => {
    if (!alive || !(element instanceof HTMLElement) || element.parentElement?.closest(POST) || bindings.has(element)) return;
    bindings.forEach((binding, post) => { if (!post.isConnected) { if (post === activePost) closePicker(); binding.stop(); binding.row.remove(); bindings.delete(post); } });
    const row = document.createElement('div'); row.dataset.vkifyPostSummary = '';
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.textContent = ru ? 'Кратко' : 'Summarize';
    trigger.title = label; trigger.setAttribute('aria-label', label); trigger.setAttribute('aria-haspopup', 'menu'); trigger.setAttribute('aria-expanded', 'false');
    trigger.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); if (alive) showPicker(element, trigger); });
    trigger.addEventListener('keydown', event => {
      if (!event.defaultPrevented && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault(); event.stopPropagation(); if (alive) showPicker(element, trigger, event.key === 'ArrowUp');
      }
    });
    row.append(trigger);
    let previousText = '';
    const sync = (): void => {
      if (!alive || !element.isConnected) { if (element === activePost) closePicker(); return; }
      const source = textElement(element);
      if (!source?.textContent?.trim()) { row.remove(); if (element === activePost) closePicker(); return; }
      if (source.textContent !== previousText && element === activePost) closePicker();
      previousText = source.textContent;
      if (source.nextElementSibling !== row) { if (element === activePost) closePicker(); source.after(row); }
    };
    const stop = ctx.observeChanges(sync, { container: element, schedule: 'frame' });
    bindings.set(element, { row, stop }); sync();
  });
  return () => { alive = false; closePicker(); bindings.forEach(({ row, stop }) => { stop(); row.remove(); }); bindings.clear(); };
}
