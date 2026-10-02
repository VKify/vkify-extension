// @vitest-environment happy-dom
import React, { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import Checkbox from './Checkbox.js';
import { createCheckbox } from '@/shared/ui/checkbox.js';

it('shares native semantics and styles with content controls, supports refs and mixed state', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host), ref = createRef<HTMLInputElement>(), change = vi.fn();
  try {
    await act(async () => root.render(React.createElement('label', null, React.createElement(Checkbox, { ref, checked: false, indeterminate: true, onChange: change }), 'Select')));
    expect(ref.current?.type).toBe('checkbox');
    expect(ref.current?.indeterminate).toBe(true);
    expect(ref.current?.className.trim()).toBe(createCheckbox().className);
    await act(async () => (host.querySelector('label') as HTMLLabelElement).click());
    expect(change).toHaveBeenCalledTimes(1);
    await act(async () => root.render(React.createElement(Checkbox, { ref, checked: true, disabled: true, indeterminate: false, onChange: change })));
    expect(ref.current?.indeterminate).toBe(false);
    await act(async () => ref.current?.click());
    expect(change).toHaveBeenCalledTimes(1);
  } finally { await act(async () => root.unmount()); host.remove(); }
});
