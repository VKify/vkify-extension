import { describe, it, expect } from 'vitest';
import { FUNCTIONS } from '../popup/constants/functions.js';
import { TABS } from '../popup/constants/tabs.js';
import { SETTINGS_SCHEMA } from '../shared/constants/settings-schema.js';

/**
 * Синхронизация реестра поиска (Ctrl+K) с реальным UI.
 *
 * Палитра по выбору функции зовёт `onNavigate(fn.tab, fn.id)` — App
 * переключает вкладку и ищет в DOM элемент `[data-vkify-anchor="fn.id"]`,
 * чтобы подсветить контрол. Если у функции «битый» tab или id, на который
 * нет якоря, deep-link молча не сработает. Раньше такой рассинхрон ловился
 * только глазами (custom_accent/appearance_profiles были якорями без функций —
 * это обратное направление и оно НЕ проверяется: якорь без функции легален).
 *
 * «Вселенная якорей» собирается из надёжных источников, переживающих
 * data-driven рендер (`<SettingRow id={el.id} />` в циклах не даёт литерала):
 *   • ключи SETTINGS_SCHEMA — покрывают все hide_-, block_- и прочие тогглы;
 *   • литералы `data-vkify-anchor="x"` и `id="x"` в исходниках попапа.
 */

// Сырой текст всех исходников попапа через vite-glob — без node:fs, чтобы tsc
// (tsconfig.app без типов node) не спотыкался, а тест не зависел от ФС-путей.
const SOURCE_MODULES = import.meta.glob('../popup/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const POPUP_SOURCE = Object.values(SOURCE_MODULES).join('\n');

/** Якоря-литералы из JSX: `data-vkify-anchor="x"` и `id="x"`. */
const LITERAL_ANCHORS = new Set(
  [...POPUP_SOURCE.matchAll(/(?:data-vkify-anchor|id)=["']([a-z0-9_]+)["']/g)].map(m => m[1]),
);

/** Полная вселенная якорей, к которой может вести функция. */
const ANCHOR_UNIVERSE = new Set<string>([
  ...Object.keys(SETTINGS_SCHEMA),
  ...LITERAL_ANCHORS,
]);

/**
 * Функции, чей контрол рендерится config-driven и не попадает ни в схему, ни в
 * литералы (id приходит из массива, ключ не trust-boundary). Это легальные
 * исключения — но список держим явным, чтобы новый «битый» id не проскользнул.
 */
const ANCHORLESS_ALLOWLIST = new Set<string>([
  'prevent_typing',
  'prevent_read',
]);

const TAB_IDS = new Set(TABS.map(t => t.id));

describe('FUNCTIONS ↔ tabs/anchors sync (Ctrl+K deep-link)', () => {
  it('каждая функция ведёт на существующую вкладку', () => {
    const badTabs = FUNCTIONS.filter(f => !TAB_IDS.has(f.tab)).map(f => `${f.id} → tab:'${f.tab}'`);
    expect(badTabs, `неизвестные tab id в functions.ts:\n${badTabs.join('\n')}`).toEqual([]);
  });

  it('id функций уникальны (иначе BY_ID/избранное молча теряет дубль)', () => {
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const f of FUNCTIONS) {
      if (seen.has(f.id)) dups.push(f.id);
      seen.add(f.id);
    }
    expect(dups, `дубликаты id:\n${dups.join('\n')}`).toEqual([]);
  });

  it('у каждой функции есть якорь в UI (или явное исключение)', () => {
    const orphans = FUNCTIONS
      .filter(f => !ANCHOR_UNIVERSE.has(f.id) && !ANCHORLESS_ALLOWLIST.has(f.id))
      .map(f => f.id);
    expect(
      orphans,
      `функции без якоря data-vkify-anchor/контрола — Ctrl+K не подсветит:\n${orphans.join('\n')}\n` +
      `добавьте якорь в UI или внесите id в ANCHORLESS_ALLOWLIST, если это намеренно`,
    ).toEqual([]);
  });

  it('allowlist не протух (все его id ещё существуют в FUNCTIONS)', () => {
    const functionIds = new Set(FUNCTIONS.map(f => f.id));
    const stale = [...ANCHORLESS_ALLOWLIST].filter(id => !functionIds.has(id));
    expect(stale, `устаревшие записи в ANCHORLESS_ALLOWLIST:\n${stale.join('\n')}`).toEqual([]);
  });
});
