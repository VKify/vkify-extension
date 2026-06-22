import React, { memo, useState, useCallback, useMemo } from 'react';
import { BookmarkIcon, ChevronDownIcon, PlusIcon, TrashIcon, EditIcon, CheckIcon, XIcon, SaveIcon, ImageIcon } from '../../icons/Icons.js';
import { useThemeProfiles } from '@/popup/hooks/features/useThemeProfiles.js';
import { findThemeById, FONTS } from '@/popup/constants/appearance.js';
import type { AppearanceProfile } from '@/popup/utils/appearanceProfile.js';

/** Визуальная подсказка для свотча профиля, вытянутая из его снимка настроек. */
interface ProfilePreview {
  bg: string;
  accent: string | null;
  hasBackground: boolean;
  fontName: string | null;
  paramCount: number;
}

function getPreview(profile: AppearanceProfile): ProfilePreview {
  const s = profile.settings;
  const themeId = typeof s['custom_theme_id'] === 'string' ? (s['custom_theme_id'] as string) : '';
  const theme = themeId ? findThemeById(themeId) : null;

  const bg =
    (typeof s['custom_theme'] === 'string' && s['custom_theme']) ||
    (theme?.color) ||
    'var(--bg-tertiary)';

  const accent =
    (typeof s['custom_accent'] === 'string' && s['custom_accent']) ||
    (theme?.accent || null);

  let fontName: string | null = null;
  if (typeof s['custom_font_id'] === 'string' && s['custom_font_id']) {
    fontName = FONTS.find(f => f.id === s['custom_font_id'])?.name ?? null;
  } else if (typeof s['custom_font_value'] === 'string' && s['custom_font_value']) {
    fontName = 'Свой шрифт';
  }

  return {
    bg,
    accent,
    hasBackground: Boolean(s['custom_background']),
    fontName,
    paramCount: Object.keys(s).length,
  };
}

interface ProfileRowProps {
  profile: AppearanceProfile;
  isActive: boolean;
  onApply: () => void;
  onUpdate: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}

const ProfileRow = memo(function ProfileRow({
  profile, isActive, onApply, onUpdate, onRename, onDelete,
}: ProfileRowProps): React.ReactElement {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(profile.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const preview = useMemo(() => getPreview(profile), [profile]);

  const commitRename = useCallback((): void => {
    onRename(draft);
    setIsEditing(false);
  }, [draft, onRename]);

  return (
    <div
      className={`rounded-xl border transition-all ${
        isActive
          ? 'border-primary/60 bg-primary/5'
          : 'border-[var(--border-color)] hover:border-[var(--text-tertiary)]'
      }`}
    >
      <div className="flex items-center gap-2.5 p-2">
        {/* Свотч-превью — кликабельный, применяет профиль */}
        <button
          onClick={onApply}
          title="Применить профиль"
          className="relative w-11 h-11 rounded-lg flex-shrink-0 overflow-hidden ring-1 ring-[var(--border-color)] transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: preview.bg }}
        >
          {preview.accent && (
            <span
              className="absolute bottom-1 right-1 w-3 h-3 rounded-full border border-white/40"
              style={{ backgroundColor: preview.accent }}
            />
          )}
          {preview.hasBackground && (
            <span className="absolute top-0.5 left-0.5 text-[8px] leading-none">
              <ImageIcon className="w-2.5 h-2.5 text-white/90 drop-shadow" />
            </span>
          )}
        </button>

        {/* Имя + мета */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') { setDraft(profile.name); setIsEditing(false); }
                }}
                className="flex-1 min-w-0 px-2 py-1 text-sm bg-[var(--bg-secondary)] border border-primary/40 rounded-lg focus:outline-none text-[var(--text-primary)]"
              />
              <button
                onClick={commitRename}
                className="p-1 text-success hover:bg-success/10 rounded-md"
                aria-label="Сохранить название"
              >
                <CheckIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setDraft(profile.name); setIsEditing(false); }}
                className="p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] rounded-md"
                aria-label="Отменить"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={onApply} className="block w-full text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {profile.name}
                </span>
                {isActive && (
                  <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold text-primary bg-primary/10 rounded-md">
                    <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                    Активен
                  </span>
                )}
              </div>
              <span className="text-[10px] text-[var(--text-tertiary)] truncate block">
                {preview.paramCount} парам.{preview.fontName ? ` · ${preview.fontName}` : ''}
              </span>
            </button>
          )}
        </div>

        {/* Действия */}
        {!isEditing && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {confirmDelete ? (
              <>
                <button
                  onClick={onDelete}
                  className="px-2 py-1 text-[10px] font-semibold text-white bg-error rounded-md hover:bg-error/90"
                >
                  Удалить
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] rounded-md"
                  aria-label="Отменить удаление"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onUpdate}
                  title="Перезаписать текущим оформлением"
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                  aria-label="Обновить профиль"
                >
                  <SaveIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setDraft(profile.name); setIsEditing(true); }}
                  title="Переименовать"
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-md transition-colors"
                  aria-label="Переименовать профиль"
                >
                  <EditIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  title="Удалить"
                  className="p-1.5 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-md transition-colors"
                  aria-label="Удалить профиль"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

interface ProfilesSectionProps {
  /** Рендер как тело отдельной страницы: без сворачиваемой карточки и шапки. */
  asPage?: boolean;
}

const ProfilesSection = memo(function ProfilesSection({ asPage = false }: ProfilesSectionProps): React.ReactElement {
  const {
    profiles, activeProfileId, currentParamCount,
    saveProfile, applyProfile, updateProfile, renameProfile, deleteProfile,
  } = useThemeProfiles();

  const [isExpanded, setIsExpanded] = useState(false);
  const [newName, setNewName] = useState('');
  const expanded = asPage || isExpanded;

  const canSave = currentParamCount > 0;

  const handleSave = useCallback(async (): Promise<void> => {
    const ok = await saveProfile(newName);
    if (ok) setNewName('');
  }, [saveProfile, newName]);

  return (
    <section className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-2' : ''}`}>
      {!asPage && (
      <button
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        className="group w-full flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/50 transition-all duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <BookmarkIcon className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-left">
            <span className="text-base font-semibold text-[var(--text-primary)] block">Мои профили</span>
            {profiles.length > 0 ? (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-amber-500">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                {profiles.length} сохранено
              </span>
            ) : (
              <span className="text-xs text-[var(--text-secondary)]">Сохраните текущее оформление</span>
            )}
          </div>
        </div>

        <div className={`w-8 h-8 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center transition-all duration-300 group-hover:bg-[var(--bg-tertiary)] ${isExpanded ? 'rotate-180 bg-primary/10' : ''}`}>
          <ChevronDownIcon className={`w-4 h-4 transition-colors duration-200 ${isExpanded ? 'text-primary' : 'text-[var(--text-tertiary)]'}`} />
        </div>
      </button>
      )}

      <div className={asPage ? '' : `grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className={asPage ? '' : 'overflow-hidden'}>
          <div className="px-4 pb-4 space-y-3">
            {/* Сохранить текущее */}
            <div className="bg-[var(--bg-secondary)] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--text-primary)]">Сохранить текущее</span>
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                  canSave ? 'text-primary bg-primary/10' : 'text-[var(--text-tertiary)] bg-[var(--bg-tertiary)]'
                }`}>
                  {currentParamCount} парам.
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && canSave) void handleSave(); }}
                  placeholder="Название профиля"
                  maxLength={40}
                  className="flex-1 min-w-0 px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:border-primary text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
                <button
                  onClick={() => { void handleSave(); }}
                  disabled={!canSave}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-primary text-white rounded-xl hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  <PlusIcon className="w-4 h-4" />
                  Сохранить
                </button>
              </div>
              {!canSave && (
                <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">
                  Сначала настройте тему, шрифт, фон или фильтры
                </p>
              )}
            </div>

            {/* Список профилей */}
            {profiles.length > 0 ? (
              <div className="space-y-2">
                {profiles.map((profile) => (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    isActive={activeProfileId === profile.id}
                    onApply={() => { void applyProfile(profile.id); }}
                    onUpdate={() => { void updateProfile(profile.id); }}
                    onRename={(name) => { void renameProfile(profile.id, name); }}
                    onDelete={() => { void deleteProfile(profile.id); }}
                  />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-xs text-[var(--text-tertiary)]">
                  Пока нет сохранённых профилей
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

export default ProfilesSection;
