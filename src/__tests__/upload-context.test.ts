import { describe, it, expect } from 'vitest';
import { parsePageContext } from '../content/features/center/music/upload-context.js';

describe('parsePageContext', () => {
  it('распознаёт личную страницу /audios{id} (owner_id положительный)', () => {
    expect(parsePageContext('/audios12345')).toEqual({ type: 'user', ownerId: 12345 });
  });

  it('распознаёт страницу сообщества /audios-{id} (owner_id отрицательный)', () => {
    expect(parsePageContext('/audios-12345')).toEqual({ type: 'group', ownerId: -12345 });
  });

  it('распознаёт /club{id}, /public{id}, /event{id} как сообщество', () => {
    expect(parsePageContext('/club777')).toEqual({ type: 'group', ownerId: -777 });
    expect(parsePageContext('/public777')).toEqual({ type: 'group', ownerId: -777 });
    expect(parsePageContext('/event777')).toEqual({ type: 'group', ownerId: -777 });
  });

  it('игнорирует хвост пути и query-параметры', () => {
    expect(parsePageContext('/audios12345?section=all')).toEqual({ type: 'user', ownerId: 12345 });
    expect(parsePageContext('/club777/something')).toEqual({ type: 'group', ownerId: -777 });
  });

  it('возвращает null для нераспознанных страниц', () => {
    expect(parsePageContext('/feed')).toBeNull();
    expect(parsePageContext('/im')).toBeNull();
    expect(parsePageContext('/audiosX')).toBeNull();
    expect(parsePageContext('/clubname')).toBeNull(); // /club без числового id
    expect(parsePageContext('/audios0')).toBeNull();   // нулевой id невалиден
  });
});
