// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { createCandidateIndex } from './candidate-index.js';

const stops: (() => void)[] = [];
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

it('discovers once and searches only new subtrees after unrelated discussion changes', async () => {
  document.body.innerHTML = '<aside><a data-testid="anchor"></a></aside><main id="comments"></main>';
  const changed = vi.fn();
  const select = vi.fn((anchor: Element) => [anchor.parentElement!]);
  const index = createCandidateIndex();
  stops.push(index.add({ selector: '[data-testid="anchor"]', select }, changed));
  const wholeDocument = vi.spyOn(document, 'querySelectorAll');
  const wholeBody = vi.spyOn(document.body, 'querySelectorAll');
  const comments = document.getElementById('comments')!;
  const oldComments = vi.spyOn(comments, 'querySelectorAll');
  select.mockClear(); changed.mockClear();
  comments.insertAdjacentHTML('beforeend', '<article><div>New reply</div></article>');
  await settle();
  expect(wholeDocument).not.toHaveBeenCalled(); expect(wholeBody).not.toHaveBeenCalled();
  expect(oldComments).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
  expect(changed).not.toHaveBeenCalled();
  comments.insertAdjacentHTML('beforeend', '<article><a data-testid="anchor"></a></article>');
  await settle();
  expect(changed).toHaveBeenCalledOnce();
  expect(changed.mock.calls[0][0].size).toBe(2);
});

it('handles identities, moves, shared targets, removal and reinsert without stale results', async () => {
  document.body.innerHTML = '<section id="one"><a></a><a></a></section><section id="two"></section>';
  const one = document.getElementById('one')!;
  const two = document.getElementById('two')!;
  const [a, b] = [...one.children];
  let selected: ReadonlySet<Element> = new Set();
  stops.push(createCandidateIndex().add({ selector: 'a[href]', select: anchor => [anchor.parentElement!] }, value => { selected = value; }));
  a.setAttribute('href', '/first'); b.setAttribute('href', '/second'); await settle();
  expect([...selected]).toEqual([one]);
  a.remove(); await settle(); expect([...selected]).toEqual([one]);
  two.append(b); await settle(); expect([...selected]).toEqual([two]);
  b.removeAttribute('href'); await settle(); expect(selected.size).toBe(0);
  one.append(a); await settle(); expect([...selected]).toEqual([one]);
  stops[0](); expect(selected.size).toBe(0);
});

it('reevaluates local predicates when descendants or ancestor context change', async () => {
  document.body.innerHTML = '<main><section class="banner"></section></main>';
  const main = document.querySelector('main')!;
  const banner = main.firstElementChild!;
  let selected: ReadonlySet<Element> = new Set();
  stops.push(createCandidateIndex().add({
    selector: '.banner', context: anchor => anchor.parentElement,
    select: anchor => anchor.parentElement?.id === 'spa' && anchor.querySelector('a[href]') ? [anchor] : [],
  }, value => { selected = value; }));
  banner.innerHTML = '<a>Hydrating</a>'; main.id = 'spa'; await settle();
  expect(selected.size).toBe(0);
  banner.firstElementChild!.setAttribute('href', '/promo'); await settle();
  expect([...selected]).toEqual([banner]);
  banner.firstElementChild!.remove(); await settle(); expect(selected.size).toBe(0);
});

it('coalesces nested additions and disconnects when the last relation stops', async () => {
  const index = createCandidateIndex();
  const select = vi.fn((anchor: Element) => [anchor]);
  const stop = index.add({ selector: '[title]', select }, () => {}); stops.push(stop);
  const root = document.createElement('div'); document.body.append(root);
  root.innerHTML = '<div><a title="new"></a></div>';
  const query = vi.spyOn(root, 'querySelectorAll'); await settle();
  expect(query).toHaveBeenCalledOnce(); expect(select).toHaveBeenCalledOnce();
  stop(); select.mockClear(); query.mockClear();
  root.innerHTML = '<a title="after stop"></a>'; await settle();
  expect(query).not.toHaveBeenCalled(); expect(select).not.toHaveBeenCalled();
});
