import React, { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { CheckIcon, ChevronDownIcon, SearchIcon } from '@/popup/components/icons/Icons.js';
import { useEmbedViewport } from '@/popup/hooks/core/useEmbedViewport.js';
import type { SelectProps } from './FormControls.js';
import { FIELD_CLASS } from './form-control-style.js';

interface Choice { value: string; label: string; disabled: boolean; group: string }

function isDisabled(select: HTMLSelectElement | null): boolean {
  if (!select || select.disabled) return true;
  for (let parent = select.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLFieldSetElement && parent.disabled
      && !parent.querySelector(':scope > legend')?.contains(select)) return true;
  }
  return false;
}

/** A themed listbox backed by a native select for form values and change events. */
export default forwardRef<HTMLSelectElement, SelectProps>(function CustomSelect({
  className = '', icon, children, value, defaultValue, disabled, onChange, id, ...props
}, ref) {
  const { t } = useTranslation('common');
  const generatedId = useId(), listId = `${generatedId}-list`;
  const native = useRef<HTMLSelectElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null), searchInput = useRef<HTMLInputElement>(null);
  const [choices, setChoices] = useState<Choice[]>([]), [selected, setSelected] = useState('');
  const [label, setLabel] = useState(''), [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const [active, setActive] = useState(-1), [position, setPosition] = useState<React.CSSProperties>({});
  const typed = useRef({ text: '', time: 0 });
  const viewport = useEmbedViewport();
  const searchable = choices.length > 8;
  const visible = choices.filter(choice => choice.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const selectedChoice = choices.find(choice => choice.value === selected);
  const accessibleLabel = props['aria-label'] || label;
  useImperativeHandle(ref, () => native.current!);

  useLayoutEffect(() => {
    const select = native.current!;
    setChoices(Array.from(select.options, option => ({ value: option.value, label: option.label ?? option.textContent ?? '',
      disabled: option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled),
      group: option.parentElement instanceof HTMLOptGroupElement ? option.parentElement.label : '' })));
    setSelected(select.value);
    // Preserve names from existing wrapping labels without requiring caller migrations.
    const parentLabel = trigger.current?.closest('label');
    if (parentLabel) {
      const copy = parentLabel.cloneNode(true) as HTMLElement;
      copy.querySelector('.form-select-shell')?.remove();
      setLabel(copy.textContent?.trim() || '');
    }
  }, [children, value, defaultValue]);

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect();
      const topEdge = Math.max(8, viewport?.top ?? 0);
      const bottomEdge = Math.min(window.innerHeight, viewport ? viewport.top + viewport.height : window.innerHeight) - 8;
      if (rect.bottom < topEdge || rect.top > bottomEdge || isDisabled(native.current)) { setOpen(false); return; }
      const above = Math.max(0, rect.top - topEdge - 6), below = Math.max(0, bottomEdge - rect.bottom - 6);
      const up = below < 180 && above > below;
      const maxHeight = Math.min(320, up ? above : below);
      const width = Math.min(Math.max(rect.width, 180), window.innerWidth - 16);
      setPosition({ position: 'fixed', width, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        maxHeight, ...(up ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.parentElement?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    // The portal is still in document flow until its position update commits.
    // Focusing its search must not scroll the page to that temporary location.
    if (searchable) searchInput.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, searchable, viewport]);

  useEffect(() => {
    if (!open || active < 0) return;
    const option = document.getElementById(`${listId}-${active}`), list = document.getElementById(listId);
    if (!option || !list) return;
    // Scroll only the options, keeping the settings page and the trigger stationary.
    const row = option.getBoundingClientRect(), bounds = list.getBoundingClientRect();
    if (row.top < bounds.top) list.scrollTop += row.top - bounds.top;
    else if (row.bottom > bounds.bottom) list.scrollTop += row.bottom - bounds.bottom;
  }, [open, active, listId]);

  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }); };
  const show = (last = false) => {
    if (isDisabled(native.current)) return;
    setSearch('');
    const available = choices.map((choice, index) => choice.disabled ? -1 : index).filter(index => index >= 0);
    const selectedIndex = choices.findIndex(choice => choice.value === selected && !choice.disabled);
    setActive(selectedIndex >= 0 ? selectedIndex : (last ? available[available.length - 1] : available[0]) ?? -1);
    setOpen(true);
  };
  const choose = (choice: Choice) => {
    if (choice.disabled || isDisabled(native.current)) return;
    const select = native.current!;
    select.value = choice.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };
  const keyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (event.key === 'Tab') { setOpen(false); if (event.target !== trigger.current) trigger.current?.focus({ preventScroll: true }); return; }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!open) { show(event.key === 'ArrowUp' || event.key === 'End'); return; }
      const available = visible.map((choice, index) => choice.disabled ? -1 : index).filter(index => index >= 0);
      if (!available.length) return;
      const current = available.indexOf(active);
      setActive(event.key === 'Home' ? available[0] : event.key === 'End' ? available[available.length - 1]
        : available[(current + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length]);
    } else if (event.key === 'Enter' || (event.key === ' ' && event.target === trigger.current)) {
      event.preventDefault();
      if (!open) show(); else if (visible[active]) choose(visible[active]);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.target === trigger.current) {
      event.preventDefault();
      const now = Date.now();
      typed.current = { text: (now - typed.current.time > 700 ? '' : typed.current.text) + event.key.toLocaleLowerCase(), time: now };
      const index = choices.findIndex(choice => !choice.disabled && choice.label.toLocaleLowerCase().startsWith(typed.current.text));
      if (index >= 0) { setActive(index); setOpen(true); setSearch(''); }
    }
  };

  return <span className={`form-control-shell form-select-shell ${className}`}>
    <button ref={trigger} id={id} type="button" role="combobox" aria-label={accessibleLabel || undefined}
      title={props.title} autoFocus={props.autoFocus} style={props.style}
      aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']} aria-invalid={props['aria-invalid']}
      aria-required={props.required} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined}
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined} disabled={disabled}
      className={`${FIELD_CLASS} form-control-select form-select-trigger w-full cursor-pointer ${icon ? 'form-control--icon' : ''}`}
      onKeyDown={keyDown} onClick={() => open ? close() : show()}
      onBlur={event => { if (!menu.current?.contains(event.relatedTarget as Node)) setOpen(false); }}>
      <span className="form-select-value">{selectedChoice?.label || '\u00a0'}</span>
    </button>
    <span aria-hidden="true" className={`form-select-sizer ${icon ? 'form-control--icon' : ''}`}>
      {choices.reduce((longest, choice) => choice.label.length > longest.length ? choice.label : longest, '')}
    </span>
    {icon && <span aria-hidden="true" className="form-control-icon form-control-icon--leading">{icon}</span>}
    <span aria-hidden="true" className={`form-control-icon form-control-icon--trailing ${open ? 'form-control-icon--open' : ''}`}><ChevronDownIcon /></span>
    <select {...props} ref={native} id={id ? `${id}-native` : undefined} hidden aria-hidden="true" tabIndex={-1}
      value={value} defaultValue={defaultValue} disabled={disabled} onChange={event => { setSelected(event.currentTarget.value); onChange?.(event); }}
      onInvalid={event => { event.preventDefault(); trigger.current?.focus(); show(); }}>{children}</select>
    {open && createPortal(<div ref={menu} className="form-select-menu" style={position} onKeyDown={keyDown}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node) && event.relatedTarget !== trigger.current) setOpen(false); }}>
      {searchable && <div className="form-select-search"><SearchIcon /><input ref={searchInput} type="search" aria-label={t('select.search')}
        placeholder={t('select.search')} value={search} onChange={event => { setSearch(event.target.value); setActive(-1); }}
        aria-controls={listId} aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined} /></div>}
      <div id={listId} role="listbox" aria-label={accessibleLabel || undefined} aria-labelledby={props['aria-labelledby']} className="form-select-options">
        {visible.map((choice, index) => <React.Fragment key={`${choice.value}-${index}`}>
          {choice.group && choice.group !== visible[index - 1]?.group && <div className="form-select-group" role="presentation">{choice.group}</div>}
          <div id={`${listId}-${index}`} role="option" aria-selected={choice.value === selected} aria-disabled={choice.disabled}
            data-active={index === active} data-value={choice.value} className="form-select-option"
            onMouseDown={event => event.preventDefault()} onMouseMove={() => { if (!choice.disabled) setActive(index); }} onClick={() => choose(choice)}>
            <span>{choice.label}</span>{choice.value === selected && <CheckIcon aria-hidden="true" />}
          </div>
        </React.Fragment>)}
      </div>
      {!visible.length && <p className="form-select-empty">{t('select.empty')}</p>}
    </div>, document.body)}
  </span>;
});
