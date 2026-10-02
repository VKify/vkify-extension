import { expect, it } from 'vitest';
import { parseUserList, normalizeUserIds, USER_LIST_FILE_MAX } from './user-lists.js';
import { communityReference } from './group-parser.js';

it.each([
  '1\n2\n1', 'id1, https://vk.ru/id2', 'https://vk.com/id1?from=test;2',
  '[1,2,1]', '{"ids":[1,2]}', '[{"id":1},{"id":2}]',
  'id,name\n1,"Name, with comma"\n2,Other', '\uFEFFuser_id;name\n1;First\n2;Second',
])('imports and deduplicates %s', text => { expect(parseUserList(text)).toEqual([1, 2]); });
it.each(['', '0 2', '-1', '1 NaN', '1 club2', '[1,"unknown"]', 'https://example.com/id1', 'id,name\n1,A\nwrong,B'])('rejects the entire invalid list %s', text => {
  expect(() => parseUserList(text)).toThrow();
});
it('enforces list, file and safe-integer caps', () => {
  expect(() => parseUserList('1'.repeat(USER_LIST_FILE_MAX + 1))).toThrow('USER_LIST_TOO_LARGE');
  expect(() => normalizeUserIds(Array.from({ length: 10001 }, (_, i) => i + 1))).toThrow();
  expect(() => parseUserList('9007199254740993')).toThrow();
});
it.each(['https://vk.ru/club123', 'vk.com/public123/', 'event123', '123'])('normalizes community %s', ref => { expect(communityReference(ref)).toBe('123'); });
it('accepts screen names and rejects arbitrary hosts and paths', () => {
  expect(communityReference('https://vk.ru/vkteam')).toBe('vkteam');
  for (const ref of ['https://evil.test/club1', 'https://vk.ru.evil.test/club1', 'https://vk.ru/id1/photo2', 'https://vk.ru:8080/club1', 'https://vk.ru@evil.test/club1']) {
    expect(() => communityReference(ref)).toThrow('INVALID_COMMUNITY');
  }
});
