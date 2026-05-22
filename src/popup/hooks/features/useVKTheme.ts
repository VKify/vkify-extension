import { useMemo, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import { THEMES } from '../../constants/appearance.js';
import type { Theme } from '../../constants/appearance.js';

const DEFAULT_THEME: Theme = {
  id: 'default',
  name: 'По умолчанию',
  color: '',
  accent: '',
  category: 'standard',
};

function findThemeById(id: string | undefined): Theme {
  if (!id || id === 'default') return DEFAULT_THEME;
  return THEMES.find(t => t?.id === id) || DEFAULT_THEME;
}

function isDefaultTheme(id: string | undefined): boolean {
  return !id || id === 'default';
}

export interface VKThemeHook {
  currentPreset: Theme;
  currentColor: string;
  currentAccent: string;
  currentRadius: number;
  isCustomColor: boolean;
  hasChanges: boolean;
  isPresetSelected: (theme: Theme) => boolean;
  applyPreset: (theme: Theme) => Promise<void>;
  applyCustomColor: (color: string) => Promise<void>;
  applyAccent: (color: string) => Promise<void>;
  reset: () => Promise<void>;
  resetAccent: () => Promise<void>;
}

export function useVKTheme(): VKThemeHook {
  const { settings, saveSetting, saveMultiple } = useSettings();

  const currentPreset = useMemo(
    () => findThemeById(settings['custom_theme_id'] as string | undefined),
    [settings['custom_theme_id']]
  );

  const isCustomColor = useMemo(() => {
    if (!settings['custom_theme']) return false;
    return !THEMES.some(
      t => t?.color === settings['custom_theme'] && t?.id !== 'default'
    );
  }, [settings['custom_theme']]);

  const currentColor = (settings['custom_theme'] as string) || '';
  const currentAccent = (settings['custom_accent'] as string) || '';
  const currentRadius = (settings['theme_radius'] as number) || 0;

  const hasChanges = useMemo(
    () => Boolean(
      settings['custom_theme'] ||
      settings['custom_accent'] ||
      (settings['theme_radius'] as number) > 0 ||
      (typeof settings['block_opacity'] === 'number' && (settings['block_opacity'] as number) < 1) ||
      (typeof settings['glass_blur'] === 'number' && (settings['glass_blur'] as number) > 0)
    ),
    [
      settings['custom_theme'],
      settings['custom_accent'],
      settings['theme_radius'],
      settings['block_opacity'],
      settings['glass_blur'],
    ]
  );

  const isPresetSelected = useCallback((theme: Theme): boolean => {
    if (!theme?.id) return false;
    if (isDefaultTheme(theme.id)) {
      return !settings['custom_theme'] && !settings['custom_theme_id'];
    }
    return settings['custom_theme_id'] === theme.id;
  }, [settings['custom_theme'], settings['custom_theme_id']]);

  const applyPreset = useCallback(async (theme: Theme): Promise<void> => {
    if (!theme?.id) {
      console.error('applyPreset: invalid theme', theme);
      return;
    }
    try {
      if (isDefaultTheme(theme.id)) {
        await saveMultiple({
          custom_theme_id: '',
          custom_theme: '',
          custom_accent: '',
          block_opacity: 1,
          glass_blur: 0,
        });
      } else {
        await saveMultiple({
          custom_theme_id: theme.id,
          custom_theme: theme.color || '',
          custom_accent: theme.accent || '',
        });
      }
    } catch (error) {
      console.error('Failed to apply VK theme preset:', error);
      throw error;
    }
  }, [saveMultiple]);

  const applyCustomColor = useCallback(async (color: string): Promise<void> => {
    try {
      await saveMultiple({ custom_theme_id: '', custom_theme: color || '' });
    } catch (error) {
      console.error('Failed to apply custom color:', error);
      throw error;
    }
  }, [saveMultiple]);

  const applyAccent = useCallback(async (color: string): Promise<void> => {
    try {
      await saveSetting('custom_accent', color || '');
    } catch (error) {
      console.error('Failed to apply accent:', error);
      throw error;
    }
  }, [saveSetting]);

  const reset = useCallback(async (): Promise<void> => {
    try {
      await saveMultiple({
        custom_theme_id: '',
        custom_theme: '',
        custom_accent: '',
        theme_radius: 0,
        block_opacity: 1,
        glass_blur: 0,
      });
    } catch (error) {
      console.error('Failed to reset VK theme:', error);
      throw error;
    }
  }, [saveMultiple]);

  const resetAccent = useCallback(async (): Promise<void> => {
    try {
      await saveSetting('custom_accent', '');
    } catch (error) {
      console.error('Failed to reset accent:', error);
      throw error;
    }
  }, [saveSetting]);

  return {
    currentPreset,
    currentColor,
    currentAccent,
    currentRadius,
    isCustomColor,
    hasChanges,
    isPresetSelected,
    applyPreset,
    applyCustomColor,
    applyAccent,
    reset,
    resetAccent,
  };
}