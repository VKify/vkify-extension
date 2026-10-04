import { Input } from '@/popup/components/ui/FormControls.js';
import { useEffect, useId, useRef, useState } from 'react';
import type { ParserGroup } from '@/shared/group-parser.js';
import { ChevronDownIcon, CommunitiesIcon, SearchIcon, CheckIcon } from '@/popup/components/icons/Icons.js';

function Avatar({ group }: { group?: ParserGroup }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [group?.photo_100]);
  return <span className="ct-avatar">{group?.photo_100 && !failed
    ? <img src={group.photo_100} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <CommunitiesIcon />}</span>;
}

export default function CommunityPicker({ groups, value, onChange, label, searchLabel, emptyLabel, disabled }: {
  groups: ParserGroup[]; value: string; onChange: (id: string) => void; label: string; searchLabel: string; emptyLabel: string; disabled: boolean;
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState('');
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), searchInput = useRef<HTMLInputElement>(null);
  const id = useId(), selected = groups.find(group => String(group.id) === value);
  const visible = groups.filter(group => group.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  useEffect(() => { if (open) searchInput.current?.focus(); }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div ref={root} className="parser-picker" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
      if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const options = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
        if (!options.length) return;
        event.preventDefault(); const current = options.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
          : current < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next].focus();
      }
    }}>
    <button ref={trigger} type="button" className="parser-picker__trigger" aria-label={label} aria-expanded={open} aria-haspopup="listbox" aria-controls={id}
      disabled={disabled} onClick={() => { setOpen(!open); setSearch(''); }}><Avatar group={selected} /><span>{selected?.name ?? label}</span><ChevronDownIcon /></button>
    {open && <div className="parser-picker__menu">
      <div className="ct-search"><SearchIcon /><Input className="w-full pl-9" ref={searchInput} aria-label={searchLabel} placeholder={searchLabel} value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div id={id} role="listbox" aria-label={label} className="parser-picker__options">
        {visible.map(group => <button type="button" key={group.id} role="option" aria-selected={String(group.id) === value}
          onClick={() => { onChange(String(group.id)); setOpen(false); trigger.current?.focus(); }}><Avatar group={group} /><span>{group.name}</span>{String(group.id) === value && <CheckIcon />}</button>)}
      </div>
      {!visible.length && <p className="ct-empty">{emptyLabel}</p>}
    </div>}
  </div>;
}
