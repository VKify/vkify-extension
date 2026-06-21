import React, { useState, useCallback, useRef } from 'react';
import SettingsSection from '../../ui/SettingsSection.js';
import { useSettings } from '../../../context/SettingsContext.js';

/**
 * Подстраница «Реклама → Фильтр по словам». Тело отдельной страницы функции
 * (см. AdsTab + SubpageHost): два списка слов — скрывать посты и всегда
 * показывать. Доступна только при включённом DOM-фильтре ленты.
 */

// ── Keyword list ───────────────────────────────────────────────────────────

interface KeywordListProps {
  label: string;
  placeholder: string;
  words: string[];
  tagClass: string;
  onAdd: (w: string) => void;
  onRemove: (w: string) => void;
}

function KeywordList({ label, placeholder, words, tagClass, onAdd, onRemove }: KeywordListProps): React.ReactElement {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const word = input.trim().toLowerCase();
    if (!word || words.includes(word)) { setInput(''); return; }
    onAdd(word);
    setInput('');
    inputRef.current?.focus();
  }, [input, words, onAdd]);

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </p>

      {words.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {words.map(word => (
            <span key={word} className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg ${tagClass}`}>
              {word}
              <button
                onClick={() => onRemove(word)}
                className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity text-sm leading-none"
                aria-label={`Удалить «${word}»`}
              >×</button>
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-xs bg-[var(--bg-secondary)] rounded-lg px-3 py-2 outline-none border border-transparent focus:border-[var(--border-color)] placeholder:text-[var(--text-tertiary)] text-[var(--text-primary)]"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="text-xs px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-all active:scale-95 whitespace-nowrap"
        >
          + Добавить
        </button>
      </form>
    </div>
  );
}

// ── Subpage: keyword filter ────────────────────────────────────────────────

export default function AdsKeywordsPage(): React.ReactElement {
  const { settings, saveSetting } = useSettings();
  const blockWords = (settings['custom_block_words'] as string[]) ?? [];
  const allowWords = (settings['custom_allow_words'] as string[]) ?? [];

  const addBlock    = useCallback((w: string) => void saveSetting('custom_block_words', [...blockWords, w]), [blockWords, saveSetting]);
  const removeBlock = useCallback((w: string) => void saveSetting('custom_block_words', blockWords.filter(x => x !== w)), [blockWords, saveSetting]);
  const addAllow    = useCallback((w: string) => void saveSetting('custom_allow_words', [...allowWords, w]), [allowWords, saveSetting]);
  const removeAllow = useCallback((w: string) => void saveSetting('custom_allow_words', allowWords.filter(x => x !== w)), [allowWords, saveSetting]);

  return (
    <div className="space-y-5">
      <SettingsSection>
        <div className="p-4">
          <KeywordList
            label="Скрывать посты со словами"
            placeholder="нпр: казино, вебинар, кредит..."
            words={blockWords}
            tagClass="bg-red-500/10 text-red-600 dark:text-red-400"
            onAdd={addBlock}
            onRemove={removeBlock}
          />
        </div>
      </SettingsSection>
      <SettingsSection>
        <div className="p-4">
          <KeywordList
            label="Всегда показывать посты со словами"
            placeholder="нпр: vkify, мой блог..."
            words={allowWords}
            tagClass="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            onAdd={addAllow}
            onRemove={removeAllow}
          />
        </div>
      </SettingsSection>
    </div>
  );
}
