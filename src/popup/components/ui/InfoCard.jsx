import React from 'react';

export default function InfoCard({ icon, title, text }) {
  return (
    <div className="flex gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
      <div className="text-xl">{icon}</div>
      <div>
        <div className="text-sm font-medium text-primary">{title}</div>
        <div className="text-xs text-[var(--text-secondary)]">{text}</div>
      </div>
    </div>
  );
}