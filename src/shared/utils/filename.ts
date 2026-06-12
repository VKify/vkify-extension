/** Имена файлов: чистка запрещённых символов. */

/** Запрещённые в именах файлов символы → подчёркивание; длина ≤ 180. */
export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 180);
}
