import React from 'react';

export default function Toggle({ checked, onChange, size = 'default', disabled = false }) {
  const sizes = {
    small: {
      track: 'h-5 w-9',
      thumb: 'h-4 w-4',
      translate: checked ? 'translate-x-4' : 'translate-x-0.5',
    },
    default: {
      track: 'h-6 w-11',
      thumb: 'h-5 w-5',
      translate: checked ? 'translate-x-5' : 'translate-x-0.5',
    },
  };

  const s = sizes[size];

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleClick}
      className={`
        relative inline-flex items-center rounded-full transition-all duration-200 ease-out
        ${s.track}
        ${checked 
          ? 'bg-primary shadow-inner shadow-primary/20' 
          : 'bg-[var(--bg-tertiary)]'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]
      `}
    >
      <span
        className={`
          inline-block rounded-full bg-white shadow-md transition-all duration-200 ease-out
          ${s.thumb}
          ${s.translate}
          ${checked ? 'shadow-primary/20' : 'shadow-black/10'}
        `}
      />
    </button>
  );
}