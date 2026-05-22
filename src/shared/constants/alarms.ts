/**
 * Единый источник истины для имён chrome.alarms.
 *
 * AlarmManager создаёт/удаляет алармы, SpyTracker их тоже очищает —
 * оба файла должны ссылаться на одну константу, иначе опечатка в строке
 * приведёт к молчаливому багу (аларма не очищается / не срабатывает).
 */
export const AlarmName = {
  STORAGE_MONITOR:   'monitorStorage',
  ONLINE_SPY_CHECK:  'onlineSpyCheck',
  PROFILE_SPY_CHECK: 'profileSpyCheck',
} as const;

export type AlarmNameValue = typeof AlarmName[keyof typeof AlarmName];