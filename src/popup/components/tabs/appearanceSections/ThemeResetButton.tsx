import React from 'react';
import ResetButton from '../../ui/ResetButton.js';
import { useVKTheme } from '@/popup/hooks/features/useVKTheme.js';

/**
 * Кнопка «Сбросить» для шапки страницы «Тема». Живёт отдельно от тела секции,
 * чтобы её можно было передать в topbar (`DetailPage.headerAction`), сохранив
 * доступ к состоянию темы (`hasChanges`/`reset`). Пока менять нечего — кнопка
 * не показывается.
 */
export default function ThemeResetButton(): React.ReactElement | null {
  const { hasChanges, reset } = useVKTheme();

  if (!hasChanges) return null;

  return <ResetButton onClick={reset} aria-label="Сбросить тему" />;
}
