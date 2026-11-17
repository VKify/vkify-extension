// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { POST_SUMMARY_PROVIDERS, POST_SUMMARY_INSTRUCTIONS, POST_SUMMARY_PROMPT_MAX, postSummaryProviders, postSummaryPrompt, postSummaryUrl } from '../shared/post-summary.js';
import { postSummaryText } from '../content/features/center/feed/post-summary-runtime.js';
import { isValidSettingValue } from '../shared/constants/settings-schema.js';

vi.mock('../content/core/features/index.js', () => ({ cssPlugin: () => ({}) }));
vi.mock('../content/i18n/lang.js', () => ({ getLang: () => 'ru' }));
afterEach(() => { document.body.innerHTML = ''; });

it('transfers literal post text safely through each provider URL', () => {
  const text = 'Скидка 50% & q=замена #хеш?\n"Цитата" 😀';
  const prompt = postSummaryPrompt(text);
  expect(prompt).toContain(text);
  const google = new URL(postSummaryUrl('google', prompt));
  expect(google.origin).toBe('https://www.google.com');
  expect(google.searchParams.get('udm')).toBe('50');
  expect(google.searchParams.get('q')).toBe(prompt);
  const yandex = new URL(postSummaryUrl('yandex', prompt));
  expect(yandex.origin).toBe('https://yandex.ru');
  expect(JSON.parse(yandex.searchParams.get('alice_deeplink')!)).toEqual({ text: prompt });
  expect(postSummaryUrl('yandex')).not.toContain('alice_deeplink');
  expect(postSummaryPrompt(text, 'en')).toContain('Reply in English');
});

it('extracts expanded DOM text, line breaks, links and emoji without the show-more control', () => {
  document.body.innerHTML = `<article data-post-id="-1_2" data-post-nesting-lvl="0"><header>Автор</header><div data-vkit-show-more-text><span data-testid="showmoretext-in">Начало<br><span style="display:none">Полное продолжение</span> <a href="/test">ссылка</a><img alt="😀"></span><button data-testid="showmoretext-after">Показать ещё</button></div><footer>2 часа назад 35 просмотров</footer><div class="reply_text">Комментарий</div></article>`;
  expect(postSummaryText(document.querySelector('article')!)).toBe('Начало\nПолное продолжение ссылка😀');
});

it('does not confuse a nested repost, comments or an attachment with the outer post text', () => {
  document.body.innerHTML = `<div class="post" data-post-id="-1_2" data-post-nesting-lvl="0"><div class="post" data-post-id="-1_2" data-post-nesting-lvl="0"><div data-vkit-show-more-text>Репост</div></div><div class="reply_text">Комментарий</div></div>`;
  const post = document.querySelector('.post')!;
  expect(postSummaryText(post)).toBe('');
  const text = document.createElement('div'); text.setAttribute('data-vkit-show-more-text','');
  text.innerHTML = '<div><p>Абзац 1</p><p>Абзац 2</p></div>'; post.prepend(text);
  expect(postSummaryText(post)).toBe('Абзац 1\nАбзац 2');
});

it('does not truncate long text before constructing the prompt', () => {
  const text = 'Полный текст 😀 '.repeat(2000) + 'КОНЕЦ';
  expect(postSummaryPrompt(text)).toContain(text);
});

it('uses custom instructions while always appending the complete literal post separately', () => {
  const text = 'Текст поста & # 😀\nВторая строка';
  expect(postSummaryPrompt(text, 'ru', '  Ответь одним предложением.  ')).toBe(`Ответь одним предложением.\n\n<post>\n${text}\n</post>`);
  expect(postSummaryPrompt(text, 'en', 'Give one key point.')).toBe(`Give one key point.\n\n<post>\n${text}\n</post>`);
  expect(postSummaryPrompt(text, 'ru', '   ')).toContain(POST_SUMMARY_INSTRUCTIONS.ru);
  expect(postSummaryPrompt(text, 'en', 'x'.repeat(POST_SUMMARY_PROMPT_MAX + 1))).toContain(POST_SUMMARY_INSTRUCTIONS.en);
  expect(isValidSettingValue('post_summary_prompt_ru', 'Мой запрос', 'import')).toBe(true);
  expect(isValidSettingValue('post_summary_prompt_en', '', 'import')).toBe(true);
  expect(isValidSettingValue('post_summary_prompt_ru', 'x'.repeat(POST_SUMMARY_PROMPT_MAX + 1), 'import')).toBe(false);
});

it('prepares queries for every supported chat without changing literal post text', () => {
  const prompt = postSummaryPrompt('Текст & # + % 😀');
  for (const provider of POST_SUMMARY_PROVIDERS) {
    const url = new URL(postSummaryUrl(provider, prompt));
    expect(url.protocol).toBe('https:');
    if (provider !== 'yandex') expect(url.searchParams.get(provider === 'qwen' ? 'text' : 'q')).toBe(prompt);
  }
  expect(new URL(postSummaryUrl('perplexity', prompt)).hostname).toBe('www.perplexity.ai');
  expect(new URL(postSummaryUrl('chatgpt', prompt)).hostname).toBe('chatgpt.com');
  expect(new URL(postSummaryUrl('claude', prompt)).pathname).toBe('/new');
  expect(new URL(postSummaryUrl('qwen', prompt)).searchParams.get('text')).toBe(prompt);
  expect(postSummaryUrl('qwen')).toBe('https://chat.qwen.ai/');
  expect(isValidSettingValue('post_summary_providers', ['qwen'], 'import')).toBe(true);
});

it('preserves all-disabled preferences and rejects unknown or duplicated sources on import', () => {
  expect(postSummaryProviders(undefined)).toEqual(['google', 'yandex', 'perplexity']);
  expect(postSummaryProviders([])).toEqual([]);
  expect(postSummaryProviders(['claude', 'bad', 'claude', 'perplexity'])).toEqual(['claude', 'perplexity']);
  expect(isValidSettingValue('post_summary_providers', ['perplexity', 'claude'], 'import')).toBe(true);
  expect(isValidSettingValue('post_summary_providers', [], 'import')).toBe(true);
  expect(isValidSettingValue('post_summary_providers', ['bad'], 'import')).toBe(false);
  expect(isValidSettingValue('post_summary_providers', ['google', 'google'], 'import')).toBe(false);
});
