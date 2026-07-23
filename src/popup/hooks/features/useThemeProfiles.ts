import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import { StorageKey } from '@/shared/constants/storage-keys.js';
import { getStorage, setStorage, subscribeStorage } from '../../utils/storageClient.js';
import {
  captureAppearance,
  buildApplyPatch,
  countAppearanceParams,
  matchesProfile,
  type AppearanceProfile,
} from '../../utils/appearanceProfile.js';
import i18n from '@/popup/i18n.js';

const KEY = StorageKey.APPEARANCE_PROFILES;
const MAX_PROFILES = 30;

function genId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Терпимая нормализация массива из storage — отбрасываем битые записи. */
function normalize(raw: unknown): AppearanceProfile[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((p): p is AppearanceProfile =>
    !!p && typeof p === 'object' &&
    typeof (p as AppearanceProfile).id === 'string' &&
    typeof (p as AppearanceProfile).name === 'string' &&
    !!(p as AppearanceProfile).settings && typeof (p as AppearanceProfile).settings === 'object'
  );
}

export interface ThemeProfilesHook {
  profiles: AppearanceProfile[];
  /** id профиля, чей снимок совпадает с текущим оформлением, либо null. */
  activeProfileId: string | null;
  /** Сколько не-дефолтных параметров оформления сейчас активно. */
  currentParamCount: number;
  saveProfile: (name: string) => Promise<boolean>;
  applyProfile: (id: string) => Promise<void>;
  updateProfile: (id: string) => Promise<void>;
  renameProfile: (id: string, name: string) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
}

export function useThemeProfiles(): ThemeProfilesHook {
  const settings = useVKifyStore((s) => s.settings);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<AppearanceProfile[]>([]);

  // Профили живут отдельно от settings-state (они в PRESERVED_KEYS), поэтому
  // читаем их напрямую и слушаем их собственное изменение в storage.
  useEffect(() => {
    let alive = true;

    void getStorage([KEY]).then(res => {
      if (alive) setProfiles(normalize(res[KEY]));
    });

    const off = subscribeStorage([KEY], (changes) => {
      if (changes[KEY]) setProfiles(normalize(changes[KEY].newValue));
    });

    return () => {
      alive = false;
      off();
    };
  }, []);

  const persist = useCallback(async (next: AppearanceProfile[]): Promise<void> => {
    setProfiles(next);
    await setStorage({ [KEY]: next });
  }, []);

  const saveProfile = useCallback(async (name: string): Promise<boolean> => {
    const snapshot = captureAppearance(settings);
    if (Object.keys(snapshot).length === 0) {
      showToast(i18n.t('appearance:profiles.toast.no_active_save'), 'error');
      return false;
    }
    if (profiles.length >= MAX_PROFILES) {
      showToast(i18n.t('appearance:profiles.toast.limit', { count: MAX_PROFILES }), 'error');
      return false;
    }

    const profile: AppearanceProfile = {
      id: genId(),
      name: name.trim() || i18n.t('appearance:profiles.default_name', { number: profiles.length + 1 }),
      createdAt: Date.now(),
      settings: snapshot,
    };

    await persist([profile, ...profiles]);
    showToast(i18n.t('appearance:profiles.toast.saved'), 'success');
    return true;
  }, [settings, profiles, persist, showToast]);

  const applyProfile = useCallback(async (id: string): Promise<void> => {
    const profile = profiles.find(p => p.id === id);
    if (!profile) return;
    await saveMultiple(buildApplyPatch(profile.settings));
    showToast(i18n.t('appearance:profiles.toast.applied', { name: profile.name }), 'success');
  }, [profiles, saveMultiple, showToast]);

  const updateProfile = useCallback(async (id: string): Promise<void> => {
    const snapshot = captureAppearance(settings);
    if (Object.keys(snapshot).length === 0) {
      showToast(i18n.t('appearance:profiles.toast.no_active'), 'error');
      return;
    }
    await persist(profiles.map(p =>
      p.id === id ? { ...p, settings: snapshot, createdAt: Date.now() } : p
    ));
    showToast(i18n.t('appearance:profiles.toast.updated'), 'success');
  }, [settings, profiles, persist, showToast]);

  const renameProfile = useCallback(async (id: string, name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await persist(profiles.map(p => (p.id === id ? { ...p, name: trimmed } : p)));
  }, [profiles, persist]);

  const deleteProfile = useCallback(async (id: string): Promise<void> => {
    await persist(profiles.filter(p => p.id !== id));
    showToast(i18n.t('appearance:profiles.toast.deleted'), 'success');
  }, [profiles, persist, showToast]);

  const activeProfileId = useMemo<string | null>(() => {
    return profiles.find(p => matchesProfile(settings, p))?.id ?? null;
  }, [profiles, settings]);

  const currentParamCount = useMemo<number>(
    () => countAppearanceParams(settings),
    [settings],
  );

  return {
    profiles,
    activeProfileId,
    currentParamCount,
    saveProfile,
    applyProfile,
    updateProfile,
    renameProfile,
    deleteProfile,
  };
}
