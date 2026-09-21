/**
 * Контекст мультизагрузки аудио: куда грузим (owner_id) и можно ли.
 *
 * VK разрешает загружать аудио на личную страницу пользователя или в сообщество
 * (группа/паблик/встреча). Перед загрузкой надо понять контекст и проверить права:
 *   • личная страница — только своя (owner_id === current_user_id);
 *   • сообщество       — только администратор/редактор (admin_level >= 2);
 *     модераторам (admin_level 1) и обычным участникам загрузка запрещена.
 *
 * Источник owner_id — pathname страницы; current user id берём из VK API
 * (users.get без user_ids идёт через native-bridge/token и возвращает владельца
 * сессии). Права в сообществе — через groups.getById (is_admin/admin_level).
 */

import { getService, SERVICES } from '@/content/core/services/index.js';
import { t } from '@/content/i18n/index.js';

/** Распознанный контекст страницы. */
export interface PageContext {
  /** 'user' — личная страница, 'group' — сообщество. */
  type: 'user' | 'group';
  /** owner_id со знаком: >0 — пользователь, <0 — сообщество. */
  ownerId: number;
}

/** Результат проверки прав на загрузку. */
export type AccessCheck =
  | { allowed: true;  ownerId: number; groupId: number | null; targetLabel: string; roleLabel: string | null; warning?: string }
  | { allowed: false; ownerId: number; targetLabel: string; reason: string };

/** Поля сообщества из groups.getById, нужные для проверки прав. */
interface GroupInfo {
  id?: number;
  name?: string;
  is_admin?: 0 | 1;
  admin_level?: 0 | 1 | 2 | 3;
  is_member?: 0 | 1;
}

/**
 * Парсит owner_id из pathname. Поддерживает форматы:
 *   /audios{id}, /audios-{id}, /club{id}, /public{id}, /event{id}.
 * Возвращает null, если страница не распознана как аудио/сообщество.
 */
export function parsePageContext(pathname: string): PageContext | null {
  // /audios123 → пользователь 123 ; /audios-123 → сообщество -123 (знак уже в URL).
  const audios = pathname.match(/^\/audios(-?\d+)/);
  if (audios) {
    const id = Number(audios[1]);
    if (!Number.isFinite(id) || id === 0) return null;
    return { type: id < 0 ? 'group' : 'user', ownerId: id };
  }

  // /club123, /public123, /event123 → сообщество (owner_id всегда отрицательный).
  const community = pathname.match(/^\/(?:club|public|event)(\d+)/);
  if (community) {
    const id = Number(community[1]);
    if (!Number.isFinite(id) || id === 0) return null;
    return { type: 'group', ownerId: -id };
  }

  return null;
}

/** ID авторизованного пользователя (владельца сессии) или null. */
async function getCurrentUserId(): Promise<number | null> {
  const me = await getService(SERVICES.vkApi).getCurrentUser();
  return me?.id ?? null;
}

/** Нормализует ответ groups.getById: и массив (legacy), и {groups:[…]} (v5.199+). */
function firstGroup(resp: unknown): GroupInfo | null {
  if (Array.isArray(resp)) return (resp[0] as GroupInfo) ?? null;
  if (resp && typeof resp === 'object') {
    const arr = (resp as { groups?: unknown }).groups;
    if (Array.isArray(arr)) return (arr[0] as GroupInfo) ?? null;
  }
  return null;
}

/**
 * Проверка прав в сообществе через groups.getById.
 *
 * Важно: наша кнопка инжектится только рядом с НАТИВНОЙ кнопкой загрузки VK,
 * которую VK показывает лишь тем, у кого есть права. Поэтому groups.getById —
 * это уточнение роли, а НЕ жёсткий гейт: если метод недоступен (токен протух,
 * native-bridge отверг вызов), мы не блокируем загрузку, а пропускаем её с
 * предупреждением — реальные права всё равно проверит сам VK на audio.save.
 * Блокируем только тогда, когда VK явно вернул недостаточную роль.
 */
async function checkGroupAccess(ownerId: number): Promise<AccessCheck> {
  const groupId = Math.abs(ownerId);
  let group: GroupInfo | null = null;

  try {
    // group_ids (мн. ч.) — актуальный параметр; ответ может быть и массивом, и
    // {groups:[…]} → нормализуем через firstGroup. fields — чтобы пришли
    // is_admin/admin_level.
    const resp = await getService(SERVICES.vkApi).call('groups.getById', {
      group_ids: groupId,
      fields: 'is_admin,admin_level',
    });
    group = firstGroup(resp);
  } catch (err) {
    // API не ответил — не блокируем, грузим с предупреждением (см. док выше).
    console.warn('[VKify] groups.getById недоступен, пропускаю проверку роли:', (err as Error).message);
    return {
      allowed: true, ownerId, groupId,
      targetLabel: t('music.upload.community_n', { id: groupId }),
      roleLabel: null,
      warning: t('music.upload.role_unchecked_api'),
    };
  }

  // Метод отработал, но данных нет — тоже не блокируем (мягкий фолбэк).
  if (!group) {
    return {
      allowed: true, ownerId, groupId,
      targetLabel: t('music.upload.community_n', { id: groupId }),
      roleLabel: null,
      warning: t('music.upload.role_unchecked'),
    };
  }

  const name       = group.name?.trim() || t('music.upload.community_n', { id: groupId });
  const adminLevel = Number(group.admin_level ?? 0);
  const isAdmin    = group.is_admin === 1;

  // Загрузка аудио доступна редакторам (2) и администраторам (3).
  // Модераторы (1) и обычные участники грузить не могут.
  if (isAdmin && adminLevel >= 2) {
    return {
      allowed: true, ownerId, groupId,
      targetLabel: name,
      roleLabel: adminLevel >= 3 ? t('music.upload.admin') : t('music.upload.editor'),
    };
  }

  const reason = adminLevel === 1
    ? t('music.upload.moderator_warning')
    : t('music.upload.need_editor');
  return { allowed: false, ownerId, targetLabel: name, reason };
}

/**
 * Определяет контекст страницы и проверяет права на мультизагрузку.
 * Возвращает null, если страница не распознана (контекст неизвестен).
 */
export async function resolveUploadAccess(pathname: string): Promise<AccessCheck | null> {
  const ctx = parsePageContext(pathname);
  if (!ctx) return null;

  if (ctx.type === 'group') {
    return checkGroupAccess(ctx.ownerId);
  }

  // Личная страница: грузить можно только на свою.
  const myId = await getCurrentUserId();
  if (myId == null) {
    return {
      allowed: false, ownerId: ctx.ownerId,
      targetLabel: t('music.upload.personal_page'),
      reason: t('music.upload.no_current_user'),
    };
  }
  if (myId === ctx.ownerId) {
    return { allowed: true, ownerId: ctx.ownerId, groupId: null, targetLabel: t('music.upload.my_page'), roleLabel: null };
  }
  return {
    allowed: false, ownerId: ctx.ownerId,
    targetLabel: t('music.upload.other_page'),
    reason: t('music.upload.own_page_only'),
  };
}

// ── Ошибки VK API ──────────────────────────────────────────────────────────────

/** Достаёт код ошибки VK из исключения (число) либо null. */
function extractErrorCode(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const raw = o['error_code'] ?? o['code'];
    const n = Number(raw);
    if (Number.isFinite(n) && n !== 0) return n;
  }
  // Native-bridge отдаёт только текст — пробуем выцепить «(NNN)» / «code NNN».
  const msg = (err as Error)?.message ?? '';
  const m = msg.match(/\b(?:code\s*)?(\d{1,3})\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Человекочитаемое сообщение об ошибке загрузки с учётом контекста.
 * Спец-обработка прав доступа (15, 100, 203); остальное — исходный текст VK.
 */
export function describeUploadError(err: unknown, isGroup: boolean): string {
  const code = extractErrorCode(err);
  const msg  = (err as Error)?.message ?? String(err);

  switch (code) {
    case 15:  // Access denied
      return isGroup
        ? t('music.upload.forbidden_perms')
        : t('music.upload.forbidden_own_page');
    case 203: // Access to group denied
      return t('music.upload.no_community_access');
    case 100: // Invalid params (часто — нет прав на этот owner_id)
      return isGroup
        ? t('music.upload.vk_rejected_community')
        : t('music.upload.vk_rejected_params');
    default:
      return msg;
  }
}
