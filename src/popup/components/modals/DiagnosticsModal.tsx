import React, { useState } from 'react';
import Modal from '../ui/Modal.js';
import { useDiagnostics, type DiagStatus } from '../../hooks/features/useDiagnostics.js';

const DOT: Record<DiagStatus, string> = {
  ok:   'bg-green-500',
  warn: 'bg-amber-500',
  fail: 'bg-red-500',
  info: 'bg-gray-400',
};
const MARK: Record<DiagStatus, string> = { ok: '✓', warn: '!', fail: '✕', info: 'i' };

interface DiagnosticsModalProps {
  onClose: () => void;
}

export default function DiagnosticsModal({ onClose }: DiagnosticsModalProps): React.ReactElement {
  const { items, loading, run } = useDiagnostics();
  const [copied, setCopied] = useState(false);

  const buildReport = (): string => {
    const version = (() => {
      try { return chrome.runtime.getManifest().version; } catch { return '?'; }
    })();
    const lines = items.map(i => `[${i.status.toUpperCase()}] ${i.label}: ${i.detail}`);
    return [
      `VKify diagnostics · v${version}`,
      `UA: ${navigator.userAgent}`,
      '',
      ...lines,
    ].join('\n');
  };

  const copyReport = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildReport());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard недоступен */ }
  };

  const footer = (
    <>
      <button
        onClick={() => void run()}
        disabled={loading}
        className="flex-1 py-2 rounded-lg text-sm font-medium border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
      >
        {loading ? 'Проверка…' : 'Обновить'}
      </button>
      <button
        onClick={() => void copyReport()}
        className="flex-1 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
      >
        {copied ? 'Скопировано ✓' : 'Копировать отчёт'}
      </button>
    </>
  );

  return (
    <Modal onClose={onClose} title="Диагностика" footer={footer} maxWidthClass="max-w-md">
      <div className="p-4 space-y-2">
        <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">
          Проверка работоспособности расширения в этом браузере. Приложите «отчёт» к багрепорту.
        </p>
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-start gap-3 p-2.5 rounded-xl bg-[var(--bg-secondary)]"
          >
            <span
              className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full ${DOT[item.status]} text-white text-[11px] font-bold flex items-center justify-center`}
              aria-hidden="true"
            >
              {MARK[item.status]}
            </span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)]">{item.label}</div>
              <div className="text-xs text-[var(--text-secondary)] leading-snug break-words">{item.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
