import React from 'react';

interface LinkButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'telegram' | 'vk' | 'donate';
}

export default function LinkButton({ icon, label, onClick, variant = 'default' }: LinkButtonProps) {
  const variants: Record<string, string> = {
    default: 'hover:bg-[var(--bg-tertiary)]',
    telegram: 'hover:bg-primary/10 hover:text-primary',
    vk: 'hover:bg-primary/10 hover:text-primary',
    donate: 'hover:bg-primary/10 hover:text-primary',
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium
        bg-[var(--bg-secondary)] transition-all duration-200
        text-[var(--text-secondary)]
        ${variants[variant]}
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
