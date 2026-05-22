import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  size?: 'small' | 'default' | 'large';
  disabled?: boolean;
  label?: string;
  labelPosition?: 'left' | 'right';
  variant?: 'primary' | 'success' | 'danger';
}

export default function Toggle({
  checked,
  onChange,
  size = 'default',
  disabled = false,
  label,
  labelPosition = 'right',
  variant = 'primary',
}: ToggleProps) {
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
    large: {
      track: 'h-7 w-14',
      thumb: 'h-6 w-6',
      translate: checked ? 'translate-x-7' : 'translate-x-0.5',
    },
  };

  const variants = {
    primary: {
      checked: 'bg-primary shadow-inner shadow-primary/20',
      unchecked: 'bg-[var(--bg-tertiary)]',
      focus: 'focus:ring-primary/30',
    },
    success: {
      checked: 'bg-green-500 shadow-inner shadow-green-500/20',
      unchecked: 'bg-[var(--bg-tertiary)]',
      focus: 'focus:ring-green-500/30',
    },
    danger: {
      checked: 'bg-red-500 shadow-inner shadow-red-500/20',
      unchecked: 'bg-[var(--bg-tertiary)]',
      focus: 'focus:ring-red-500/30',
    },
  };

  const s = sizes[size];
  const v = variants[variant];

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleClick(e);
    }
  };

  const toggleButton = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || (checked ? 'Включено' : 'Выключено')}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`
        relative inline-flex items-center rounded-full
        transition-all duration-200 ease-out
        ${s.track}
        ${checked ? v.checked : v.unchecked}
        ${disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'cursor-pointer hover:opacity-90 active:scale-95'}
        focus:outline-none focus:ring-2 ${v.focus}
        focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]
      `}
    >
      <span
        className={`
          inline-block rounded-full bg-white shadow-md
          transition-all duration-200 ease-out
          ${s.thumb}
          ${s.translate}
          ${checked ? 'shadow-primary/20' : 'shadow-black/10'}
          ${!disabled && 'group-hover:scale-105'}
        `}
      >
        {size !== 'small' && (
          <span className="absolute inset-0 flex items-center justify-center">
            {checked ? (
              <svg
                className="w-3 h-3 text-primary transition-opacity duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg
                className="w-2.5 h-2.5 text-gray-400 transition-opacity duration-200"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </span>
        )}
      </span>
    </button>
  );

  if (!label) {
    return toggleButton;
  }

  return (
    <label className={`
      inline-flex items-center gap-2
      ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
      ${labelPosition === 'left' ? 'flex-row-reverse' : 'flex-row'}
    `}>
      {toggleButton}
      <span className={`text-sm select-none ${disabled ? 'opacity-50' : ''}`}>
        {label}
      </span>
    </label>
  );
}