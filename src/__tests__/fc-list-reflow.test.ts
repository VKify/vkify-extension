// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fcListReflow } from '../content/features/privacy/dialogs/fc-list-reflow.js';

const H = 44;

/** Строит скролл-контейнер мини-чата с N абсолютно позиционированными строками. */
function buildList(names: string[]): HTMLElement {
  const container = document.createElement('div');
  container.setAttribute('data-scrollbar', 'content');
  container.style.height = `${names.length * H}px`;

  names.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'FCConvoListItem';
    btn.setAttribute('aria-label', name);
    btn.style.position = 'absolute';
    btn.style.top = `${i * H}px`;
    btn.style.height = `${H}px`;
    container.appendChild(btn);
  });

  document.body.appendChild(container);
  return container;
}

function topOf(container: HTMLElement, name: string): number {
  const el = container.querySelector<HTMLElement>(`[aria-label="${name}"]`)!;
  return parseFloat(el.style.top);
}

// Даёт отработать MutationObserver (async) → coalesceFrame (rAF) → flush.
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }
}

beforeEach(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { id: 'test-id' } };
  document.body.innerHTML = '';
});

afterEach(() => {
  fcListReflow.stop();
  document.body.innerHTML = '';
});

describe('fcListReflow', () => {
  it('closes the gap and shrinks the container when a middle dialog is hidden', () => {
    const c = buildList(['Диалог 1', 'Диалог 2', 'Диалог 3', 'Диалог 4']);

    fcListReflow.start(new Set(['Диалог 2']));

    expect(topOf(c, 'Диалог 1')).toBe(0);
    expect(topOf(c, 'Диалог 3')).toBe(H);     // 88 → 44
    expect(topOf(c, 'Диалог 4')).toBe(2 * H); // 132 → 88
    expect(parseFloat(c.style.height)).toBe(3 * H); // 176 → 132 (one row removed)
  });

  it('subtracts the offset for every hidden dialog above', () => {
    const c = buildList(['Диалог 1', 'Диалог 2', 'Диалог 3', 'Диалог 4']);

    fcListReflow.start(new Set(['Диалог 1', 'Диалог 3']));

    expect(topOf(c, 'Диалог 2')).toBe(0);     // 44 → 0 (one hidden above)
    expect(topOf(c, 'Диалог 4')).toBe(H);     // 132 → 44 (two hidden above)
    expect(parseFloat(c.style.height)).toBe(2 * H);
  });

  it('is idempotent across repeated start() with the same DOM', () => {
    const c = buildList(['Диалог 1', 'Диалог 2', 'Диалог 3', 'Диалог 4']);

    fcListReflow.start(new Set(['Диалог 2']));
    const first = ['Диалог 1', 'Диалог 3', 'Диалог 4'].map(n => topOf(c, n));

    fcListReflow.start(new Set(['Диалог 2']));
    const second = ['Диалог 1', 'Диалог 3', 'Диалог 4'].map(n => topOf(c, n));

    expect(second).toEqual(first);
    expect(parseFloat(c.style.height)).toBe(3 * H);
  });

  it('recovers true positions when the hidden set grows (no cascade)', () => {
    const c = buildList(['Диалог 1', 'Диалог 2', 'Диалог 3', 'Диалог 4']);

    fcListReflow.start(new Set(['Диалог 2']));
    fcListReflow.start(new Set(['Диалог 2', 'Диалог 4']));

    expect(topOf(c, 'Диалог 1')).toBe(0);
    expect(topOf(c, 'Диалог 3')).toBe(H); // 88 − 44 = 44, NOT 0 (no double subtraction)
    expect(parseFloat(c.style.height)).toBe(2 * H);
  });

  it('compacts a mini-chat that only opens AFTER start (page reload case)', async () => {
    // start() с пустым DOM — окно мини-чата ещё не создано (как сразу после
    // перезагрузки страницы, до того как VK откроет FC-окно).
    fcListReflow.start(new Set(['Диалог 2']));
    expect(document.querySelector('.FCConvoListItem')).toBeNull();

    // VK открывает окно мини-чата позже — список появляется в DOM.
    const c = buildList(['Диалог 1', 'Диалог 2', 'Диалог 3', 'Диалог 4']);

    await settle();

    expect(topOf(c, 'Диалог 1')).toBe(0);
    expect(topOf(c, 'Диалог 3')).toBe(H);
    expect(topOf(c, 'Диалог 4')).toBe(2 * H);
    expect(parseFloat(c.style.height)).toBe(3 * H);
  });

  it('recompacts when VK rewrites the inline tops', async () => {
    const c = buildList(['Диалог 1', 'Диалог 2', 'Диалог 3', 'Диалог 4']);
    fcListReflow.start(new Set(['Диалог 2']));

    // VK перерисовал список: вернул всем полные index-позиции.
    const items = Array.from(c.querySelectorAll<HTMLElement>('.FCConvoListItem'));
    items.forEach((el, i) => { el.style.top = `${i * H}px`; });
    c.style.height = `${items.length * H}px`;

    await settle();

    expect(topOf(c, 'Диалог 3')).toBe(H);
    expect(topOf(c, 'Диалог 4')).toBe(2 * H);
    expect(parseFloat(c.style.height)).toBe(3 * H);
  });

  it('restores original layout on stop', () => {
    const c = buildList(['Диалог 1', 'Диалог 2', 'Диалог 3', 'Диалог 4']);

    fcListReflow.start(new Set(['Диалог 2']));
    fcListReflow.stop();

    expect(topOf(c, 'Диалог 3')).toBe(2 * H);
    expect(topOf(c, 'Диалог 4')).toBe(3 * H);
    expect(parseFloat(c.style.height)).toBe(4 * H);
  });
});
