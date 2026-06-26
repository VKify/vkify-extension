import React, { memo } from 'react';
import Modal from '@/popup/components/ui/Modal.js';
import { ExternalLinkIcon, InfoIcon } from '@/popup/components/icons/Icons.js';

interface FontHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Справка «Как добавить свой шрифт» (Google Fonts / системные / советы). */
const FontHelpModal = memo(function FontHelpModal({ isOpen, onClose }: FontHelpModalProps): React.ReactElement | null {
  if (!isOpen) return null;

  return (
    <Modal
      ariaLabel="Как добавить свой шрифт"
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span>📚</span>
          Как добавить свой шрифт
        </span>
      }
    >
        <div className="p-4 space-y-5">
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <span className="w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
              Через Google Fonts
            </h4>

            <div className="space-y-2 text-xs text-[var(--text-secondary)]">
              <p className="flex gap-2">
                <span className="text-primary">→</span>
                <span>
                  Откройте{' '}
                  <a
                    href="https://fonts.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    fonts.google.com
                    <ExternalLinkIcon className="w-3 h-3" />
                  </a>
                </span>
              </p>
              <p className="flex gap-2">
                <span className="text-primary">→</span>
                <span>Выберите <b>Language → Cyrillic</b> для русских шрифтов</span>
              </p>
              <p className="flex gap-2">
                <span className="text-primary">→</span>
                <span>Скопируйте название шрифта</span>
              </p>
              <p className="flex gap-2">
                <span className="text-primary">→</span>
                <span>Вставьте в формате: <code className="bg-[var(--bg-secondary)] px-1 rounded">&quot;Название&quot;, sans-serif</code></span>
              </p>
            </div>

            <div className="mt-3 p-2.5 bg-[var(--bg-secondary)] rounded-xl">
              <p className="text-[10px] font-medium text-[var(--text-tertiary)] mb-1.5">Примеры:</p>
              <div className="space-y-1">
                <code className="block text-[11px] text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded">&quot;Roboto&quot;, sans-serif</code>
                <code className="block text-[11px] text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded">&quot;Playfair Display&quot;, serif</code>
                <code className="block text-[11px] text-[var(--text-primary)] bg-[var(--bg-primary)] px-2 py-1 rounded">&quot;JetBrains Mono&quot;, monospace</code>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
              <span className="w-5 h-5 bg-primary/10 text-primary rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
              Системные шрифты
            </h4>

            <p className="text-xs text-[var(--text-secondary)] mb-2">
              Эти шрифты уже есть на компьютере:
            </p>

            <div className="grid grid-cols-2 gap-1.5">
              {[
                { name: 'Arial', value: 'Arial, sans-serif' },
                { name: 'Verdana', value: 'Verdana, sans-serif' },
                { name: 'Georgia', value: 'Georgia, serif' },
                { name: 'Times New Roman', value: '"Times New Roman", serif' },
              ].map(font => (
                <div
                  key={font.name}
                  className="p-2 bg-[var(--bg-secondary)] rounded-lg"
                >
                  <p className="text-xs font-medium text-[var(--text-primary)]" style={{ fontFamily: font.value }}>
                    {font.name}
                  </p>
                  <code className="text-[9px] text-[var(--text-tertiary)] break-all">{font.value}</code>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 bg-primary/5 rounded-xl border border-primary/20">
            <h4 className="text-xs font-semibold text-primary mb-1.5 flex items-center gap-1.5">
              <InfoIcon className="w-3.5 h-3.5 text-primary" />
              Советы
            </h4>
            <ul className="text-[11px] text-[var(--text-secondary)] space-y-1">
              <li className="flex gap-1.5">
                <span>•</span>
                <span>Названия с пробелами — в кавычках</span>
              </li>
              <li className="flex gap-1.5">
                <span>•</span>
                <span>Добавляйте fallback: <code className="bg-[var(--bg-secondary)] px-1 rounded">sans-serif</code></span>
              </li>
              <li className="flex gap-1.5">
                <span>•</span>
                <span>Выбирайте шрифты с кириллицей</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-1.5">
              <span>🔗</span>
              Где искать
            </h4>
            <div className="space-y-1.5">
              {[
                { name: 'Google Fonts', url: 'https://fonts.google.com', desc: 'Бесплатно, огромный выбор' },
                { name: 'Font Squirrel', url: 'https://www.fontsquirrel.com', desc: 'Бесплатные шрифты' },
              ].map(site => (
                <a
                  key={site.name}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors group"
                >
                  <div>
                    <p className="text-xs font-medium text-[var(--text-primary)] group-hover:text-primary">
                      {site.name}
                    </p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">{site.desc}</p>
                  </div>
                  <ExternalLinkIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] group-hover:text-primary" />
                </a>
              ))}
            </div>
          </div>
        </div>
    </Modal>
  );
});

export default FontHelpModal;
