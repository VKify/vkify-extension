import React from 'react';
import SettingRow from '../ui/SettingRow';
import { LockIcon, EyeOffIcon } from '../icons/Icons';

// Иконка скелетона
const SkeletonIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9" x2="21" y2="9"/>
    <line x1="9" y1="21" x2="9" y2="9"/>
  </svg>
);

export default function PrivacyTab() {
  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <span className="text-lg">🔐</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Приватность</h3>
        </div>

        <SettingRow
          id="privacy_mode"
          title="Режим невидимки"
          description={
            <span className="flex items-center gap-1.5">
              Скрыть чаты по 
              <kbd className="px-1.5 py-0.5 text-[10px] bg-[var(--bg-tertiary)] rounded font-mono font-medium">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 text-[10px] bg-[var(--bg-tertiary)] rounded font-mono font-medium">Q</kbd>
            </span>
          }
          icon={<EyeOffIcon className="w-5 h-5" />}
          iconColor="purple"
        />

        <div className="mx-4 border-t border-[var(--border-color)]" />

        <SettingRow
          id="skeleton_mode"
          title="Режим скелетона"
          description="Скрыть аватары, имена и текст"
          icon={<SkeletonIcon className="w-5 h-5" />}
          iconColor="orange"
        />
      </section>

      {/* Инфо блок */}
      <div className="bg-[var(--bg-primary)] rounded-2xl shadow-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <LockIcon className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">
              Как работает режим невидимки?
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              При нажатии <strong>Ctrl+Q</strong> все диалоги мгновенно скрываются. 
              Повторное нажатие возвращает их обратно. Удобно, когда кто-то смотрит на экран.
            </p>
          </div>
        </div>
      </div>

      {/* Инфо о скелетоне */}
      <div className="flex gap-3 p-3.5 rounded-xl bg-orange-500/5 border border-orange-500/10">
        <span className="text-xl flex-shrink-0">🦴</span>
        <div>
          <div className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-0.5">Режим скелетона</div>
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Заменяет все аватары, имена и текст на серые полоски. Полезно для демонстрации экрана или скриншотов.
          </div>
        </div>
      </div>
    </div>
  );
}