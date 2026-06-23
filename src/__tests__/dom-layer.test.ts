// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { safeQuerySelector, queryAll, matchesSpec } from '../content/core/dom/query.js';
import { specUnion } from '../content/selectors/types.js';
import { domObserver } from '../content/core/dom/dom-observer.js';

// dom-observer сворачивается, если контекст расширения «мёртв» — в тестах
// эмулируем живой chrome.runtime.
beforeEach(() => {
  (globalThis as unknown as { chrome: unknown }).chrome = { runtime: { id: 'test-id' } };
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Даёт отработать: callback MutationObserver (async) → coalesceFrame (rAF) → flush.
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  }
}

describe('safeQuerySelector', () => {
  it('returns the first candidate that matches (precedence order)', () => {
    document.body.innerHTML = '<div class="b">B</div><div class="a">A</div>';
    expect(safeQuerySelector(['.a', '.b'])?.textContent).toBe('A');
    expect(safeQuerySelector(['.missing', '.b'])?.textContent).toBe('B');
  });

  it('skips selectors that throw SyntaxError and falls through', () => {
    document.body.innerHTML = '<div class="ok">OK</div>';
    // ':::' — заведомо невалидный селектор; не должен ронять вызов.
    expect(safeQuerySelector([':::bad', '.ok'])?.textContent).toBe('OK');
  });

  it('returns null for a null root', () => {
    expect(safeQuerySelector('.a', null)).toBeNull();
  });
});

describe('queryAll', () => {
  it('returns the first NON-EMPTY candidate group (not a union)', () => {
    document.body.innerHTML = '<i class="x"></i><i class="x"></i><i class="y"></i>';
    // .x даёт 2 — берём их и НЕ домешиваем .y.
    expect(queryAll(['.x', '.y'])).toHaveLength(2);
    // .none пусто → переходим к .y.
    expect(queryAll(['.none', '.y'])).toHaveLength(1);
  });
});

describe('matchesSpec', () => {
  it('matches if the element fits ANY candidate (OR)', () => {
    document.body.innerHTML = '<div class="a" id="t"></div>';
    const el = document.getElementById('t')!;
    expect(matchesSpec(el, ['.z', '.a'])).toBe(true);
    expect(matchesSpec(el, ['.z', '.q'])).toBe(false);
  });
});

describe('specUnion', () => {
  it('joins candidates into a single comma selector (union semantics)', () => {
    document.body.innerHTML = '<p class="a"></p><p class="b"></p>';
    const union = specUnion(['.a', '.b']);
    expect(union).toBe('.a, .b');
    // querySelectorAll по union-строке возвращает ОБЕ группы.
    expect(document.querySelectorAll(union)).toHaveLength(2);
  });
});

describe('domObserver.observeMatches', () => {
  it('dispatches existing elements once on subscribe (initial scan)', () => {
    document.body.innerHTML = '<div class="m"></div><div class="m"></div>';
    const seen: Element[] = [];
    const off = domObserver.observeMatches('.m', (el) => seen.push(el));
    expect(seen).toHaveLength(2);
    off();
  });

  it('does not re-dispatch the same element twice', () => {
    document.body.innerHTML = '<div class="m" id="only"></div>';
    let count = 0;
    const off = domObserver.observeMatches('.m', () => count++);
    // Повторный querySelectorAll того же элемента не должен вызывать onMatch снова.
    document.body.appendChild(document.createElement('span'));
    expect(count).toBe(1);
    off();
  });

  it('dispatches dynamically inserted elements via the shared observer', async () => {
    const seen: Element[] = [];
    const off = domObserver.observeMatches('.dyn', (el) => seen.push(el));

    const el = document.createElement('div');
    el.className = 'dyn';
    document.body.appendChild(el);

    await settle();
    expect(seen).toContain(el);
    off();
  });

  it('stops dispatching after unsubscribe', async () => {
    const seen: Element[] = [];
    const off = domObserver.observeMatches('.late', (el) => seen.push(el));
    off();

    const el = document.createElement('div');
    el.className = 'late';
    document.body.appendChild(el);

    await settle();
    expect(seen).toHaveLength(0);
  });
});

describe('domObserver.waitForElement', () => {
  it('resolves immediately for an element already present', async () => {
    document.body.innerHTML = '<div class="ready"></div>';
    const el = await domObserver.waitForElement('.ready', { timeoutMs: 100 });
    expect(el).toBeInstanceOf(Element);
  });

  it('rejects on timeout when the element never appears', async () => {
    vi.useFakeTimers();
    const p = domObserver.waitForElement('.never', { timeoutMs: 50 });
    const assertion = expect(p).rejects.toThrow(/timeout/);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
    vi.useRealTimers();
  });
});
