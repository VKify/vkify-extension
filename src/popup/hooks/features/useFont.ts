import { useMemo, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext.js';
import { FONTS } from '../../constants/appearance.js';
import type { Font } from '../../constants/appearance.js';

const DEFAULT_FONT = FONTS[0];

export interface FontHook {
  currentFont: Font;
  currentFontValue: string;
  currentFontSize: number;
  currentLineHeight: number;
  currentLetterSpacing: number;
  currentFontWeight: number;
  currentFontStyle: string;
  currentTextDecoration: string;
  currentTextTransform: string;
  isCustomFont: boolean;
  hasChanges: boolean;
  isFontSelected: (font: Font) => boolean;
  applyFont: (font: Font) => Promise<void>;
  applyCustomFont: (fontValue: string) => Promise<void>;
  setFontSize: (size: number) => Promise<void>;
  setLineHeight: (value: number) => Promise<void>;
  setLetterSpacing: (value: number) => Promise<void>;
  setFontWeight: (weight: number) => Promise<void>;
  setFontStyle: (style: string) => Promise<void>;
  setTextDecoration: (decoration: string) => Promise<void>;
  setTextTransform: (transform: string) => Promise<void>;
  reset: () => Promise<void>;
}

export function useFont(): FontHook {
  const { settings, saveSetting, saveMultiple } = useSettings();

  const currentFont = useMemo(() => {
    const id = settings['custom_font_id'] as string | undefined;
    if (!id) return DEFAULT_FONT;
    return FONTS.find(f => f.id === id) || DEFAULT_FONT;
  }, [settings['custom_font_id']]);

  const isCustomFont = useMemo(() => {
    return Boolean(settings['custom_font_value'] && !settings['custom_font_id']);
  }, [settings['custom_font_value'], settings['custom_font_id']]);

  const currentFontValue = (settings['custom_font_value'] as string) || '';
  const currentFontSize = (settings['custom_font_size'] as number) || 0;
  const currentLineHeight = (settings['custom_line_height'] as number) || 0;
  const currentLetterSpacing = (settings['custom_letter_spacing'] as number) || 0;
  const currentFontWeight = (settings['custom_font_weight'] as number) || 400;
  const currentFontStyle = (settings['custom_font_style'] as string) || 'normal';
  const currentTextDecoration = (settings['custom_text_decoration'] as string) || 'none';
  const currentTextTransform = (settings['custom_text_transform'] as string) || 'none';

  const hasChanges = useMemo(() => {
    return Boolean(
      settings['custom_font_id'] ||
      settings['custom_font_value'] ||
      settings['custom_font_size'] ||
      settings['custom_line_height'] ||
      settings['custom_letter_spacing'] ||
      (settings['custom_font_weight'] && settings['custom_font_weight'] !== 400) ||
      (settings['custom_font_style'] && settings['custom_font_style'] !== 'normal') ||
      (settings['custom_text_decoration'] && settings['custom_text_decoration'] !== 'none') ||
      (settings['custom_text_transform'] && settings['custom_text_transform'] !== 'none')
    );
  }, [
    settings['custom_font_id'],
    settings['custom_font_value'],
    settings['custom_font_size'],
    settings['custom_line_height'],
    settings['custom_letter_spacing'],
    settings['custom_font_weight'],
    settings['custom_font_style'],
    settings['custom_text_decoration'],
    settings['custom_text_transform'],
  ]);

  const isFontSelected = useCallback((font: Font): boolean => {
    if (!font?.id) return false;
    if (font.id === 'default') {
      return !settings['custom_font_id'] && !settings['custom_font_value'];
    }
    return settings['custom_font_id'] === font.id;
  }, [settings['custom_font_id'], settings['custom_font_value']]);

  const applyFont = useCallback(async (font: Font): Promise<void> => {
    if (!font) return;
    try {
      if (font.id === 'default') {
        await saveMultiple({ custom_font_id: '', custom_font_value: '' });
      } else {
        await saveMultiple({ custom_font_id: font.id, custom_font_value: font.value });
      }
    } catch (error) {
      console.error('Failed to apply font:', error);
    }
  }, [saveMultiple]);

  const applyCustomFont = useCallback(async (fontValue: string): Promise<void> => {
    try {
      await saveMultiple({ custom_font_id: '', custom_font_value: fontValue || '' });
    } catch (error) {
      console.error('Failed to apply custom font:', error);
    }
  }, [saveMultiple]);

  const setFontSize = useCallback(async (size: number): Promise<void> => {
    try {
      await saveSetting('custom_font_size', size);
    } catch (error) {
      console.error('Failed to set font size:', error);
    }
  }, [saveSetting]);

  const setLineHeight = useCallback(async (value: number): Promise<void> => {
    try {
      await saveSetting('custom_line_height', value);
    } catch (error) {
      console.error('Failed to set line height:', error);
    }
  }, [saveSetting]);

  const setLetterSpacing = useCallback(async (value: number): Promise<void> => {
    try {
      await saveSetting('custom_letter_spacing', value);
    } catch (error) {
      console.error('Failed to set letter spacing:', error);
    }
  }, [saveSetting]);

  const setFontWeight = useCallback(async (weight: number): Promise<void> => {
    try {
      await saveSetting('custom_font_weight', weight);
    } catch (error) {
      console.error('Failed to set font weight:', error);
    }
  }, [saveSetting]);

  const setFontStyle = useCallback(async (style: string): Promise<void> => {
    try {
      await saveSetting('custom_font_style', style);
    } catch (error) {
      console.error('Failed to set font style:', error);
    }
  }, [saveSetting]);

  const setTextDecoration = useCallback(async (decoration: string): Promise<void> => {
    try {
      await saveSetting('custom_text_decoration', decoration);
    } catch (error) {
      console.error('Failed to set text decoration:', error);
    }
  }, [saveSetting]);

  const setTextTransform = useCallback(async (transform: string): Promise<void> => {
    try {
      await saveSetting('custom_text_transform', transform);
    } catch (error) {
      console.error('Failed to set text transform:', error);
    }
  }, [saveSetting]);

  const reset = useCallback(async (): Promise<void> => {
    try {
      await saveMultiple({
        custom_font_id: '',
        custom_font_value: '',
        custom_font_size: 0,
        custom_line_height: 0,
        custom_letter_spacing: 0,
        custom_font_weight: 400,
        custom_font_style: 'normal',
        custom_text_decoration: 'none',
        custom_text_transform: 'none',
      });
    } catch (error) {
      console.error('Failed to reset font settings:', error);
    }
  }, [saveMultiple]);

  return {
    currentFont,
    currentFontValue,
    currentFontSize,
    currentLineHeight,
    currentLetterSpacing,
    currentFontWeight,
    currentFontStyle,
    currentTextDecoration,
    currentTextTransform,
    isCustomFont,
    hasChanges,
    isFontSelected,
    applyFont,
    applyCustomFont,
    setFontSize,
    setLineHeight,
    setLetterSpacing,
    setFontWeight,
    setFontStyle,
    setTextDecoration,
    setTextTransform,
    reset,
  };
}