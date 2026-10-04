// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Select } from './FormControls.js';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
let root: Root, host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140, left: 20, right: 240, width: 220, height: 40, x: 20, y: 100, toJSON() {} });
  Object.assign(HTMLElement.prototype, { scrollIntoView() {} });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ''; vi.restoreAllMocks(); });
const trigger = () => host.querySelector<HTMLButtonElement>('[role=combobox]')!;
const options = () => Array.from(document.querySelectorAll<HTMLElement>('[role=option]'));
const key = async (name: string) => { await act(async () => trigger().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }))); };
const rows = [React.createElement('option', { key: 'a', value: 'a' }, 'Alpha'),
  React.createElement('option', { key: 'b', value: 'b', disabled: true }, 'Beta'),
  React.createElement('option', { key: 'c', value: 'c' }, 'Charlie')];

it('preserves label names and native change events while rendering a themed portal', async () => {
  const change = vi.fn();
  await act(async () => root.render(React.createElement('label', null, 'Category', React.createElement(Select, { defaultValue: 'a', onChange: change }, rows))));
  expect(trigger().getAttribute('aria-label')).toBe('Category');
  await act(async () => trigger().click());
  expect(host.querySelector('[role=listbox]')).toBeNull();
  expect(options().map(option => option.textContent)).toEqual(['Alpha', 'Beta', 'Charlie']);
  await act(async () => options()[2].click());
  expect(change).toHaveBeenCalledOnce();
  expect(change.mock.calls[0][0].target.value).toBe('c');
  expect(host.querySelector('select')!.value).toBe('c');
  expect(trigger().textContent).toBe('Charlie');
  expect(document.querySelector('[role=listbox]')).toBeNull();
  expect(document.activeElement).toBe(trigger());
});

it('supports arrow navigation, skips disabled options, and cancels without changing the value', async () => {
  const change = vi.fn();
  await act(async () => root.render(React.createElement(Select, { defaultValue: 'a', onChange: change }, rows)));
  await key('ArrowDown'); await key('ArrowDown');
  expect(options()[2].dataset.active).toBe('true');
  await key('Escape');
  expect(change).not.toHaveBeenCalled();
  expect(trigger().textContent).toBe('Alpha');
  await key('ArrowDown'); await key('End'); await key('Enter');
  expect(trigger().textContent).toBe('Charlie');
  await key('c');
  expect(trigger().getAttribute('aria-expanded')).toBe('true');
  await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
});

it('searches long lists and prevents selection from disabled groups or fieldsets', async () => {
  const longRows = Array.from({ length: 10 }, (_, index) => React.createElement('option', { key: index, value: String(index) }, `Item ${index}`));
  await act(async () => root.render(React.createElement(Select, { defaultValue: '0' }, longRows)));
  await act(async () => trigger().click());
  const search = document.querySelector<HTMLInputElement>('.form-select-search input')!;
  expect(document.activeElement).toBe(search);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Item 9');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(options().map(option => option.textContent)).toEqual(['Item 9']);
  await act(async () => options()[0].click());
  expect(trigger().textContent).toBe('Item 9');
  await act(async () => root.render(React.createElement('fieldset', { disabled: true }, React.createElement(Select, null, rows))));
  await key('ArrowDown');
  expect(document.querySelector('[role=listbox]')).toBeNull();
  await act(async () => root.render(React.createElement(Select, null,
    React.createElement('optgroup', { label: 'Unavailable', disabled: true }, rows))));
  await act(async () => trigger().click());
  expect(options().every(option => option.getAttribute('aria-disabled') === 'true')).toBe(true);
});

it('updates controlled labels and keeps native multi-selects available', async () => {
  await act(async () => root.render(React.createElement(Select, { value: 'a', onChange() {} }, rows)));
  await act(async () => root.render(React.createElement(Select, { value: 'c', onChange() {} }, rows)));
  expect(trigger().textContent).toBe('Charlie');
  await act(async () => root.render(React.createElement(Select, { multiple: true, defaultValue: ['a', 'c'] }, rows)));
  expect(host.querySelector('[role=combobox]')).toBeNull();
  expect(Array.from(host.querySelector('select')!.selectedOptions).map(option => option.value)).toEqual(['a', 'c']);
});
