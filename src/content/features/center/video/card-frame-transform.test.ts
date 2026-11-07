import { expect, it, vi } from 'vitest';
import { createVideoFrameTransformer } from './card-frame-transform.js';

const card = () => ({ id: 2, owner_id: -1, title: 'UNCHANGED', duration: 100,
  image: [{ url: 'https://sun9.userapi.com/cover.jpg' }],
  first_frame: [{ url: 'https://sun9.userapi.com/first.jpg', width: 320, height: 180 }],
  timeline_thumbs: { count_total: 3, count_per_image: 3, count_per_row: 3, frame_width: 160, frame_height: 90, links: ['https://sun9.userapi.com/sheet.jpg'] } });
const cropped = { url: 'data:image/jpeg;base64,frame', width: 160, height: 90 };

it('changes only image data before rendering and restores an unconsumed prefetch', async () => {
  const crop = vi.fn(async () => cropped), engine = createVideoFrameTransformer(crop), v = card(), before = structuredClone(v);
  expect(await engine.transform({ videos: [v] }, 'start')).toBe(true);
  expect(v.image[v.image.length - 1]).toEqual(cropped); expect(v.image).toHaveLength(2);
  expect({ ...v, image: before.image }).toEqual(before); expect(crop).toHaveBeenCalledOnce();
  engine.restore({ videos: [v] }); expect(v).toEqual(before);
});
it('crops each unique sheet position once and reuses frames across repeated cards and responses', async () => {
  const crop = vi.fn(async () => cropped), engine = createVideoFrameTransformer(crop);
  const v = card(), duplicate = card();
  await engine.transform({ items: [v, duplicate] }, 'middle');
  expect(crop).toHaveBeenCalledOnce(); expect(v.image[v.image.length - 1]).toEqual(cropped); expect(duplicate.image[duplicate.image.length - 1]).toEqual(cropped);
  await engine.transform({ items: [card()] }, 'middle'); expect(crop).toHaveBeenCalledOnce();
  await engine.transform({ items: [card()] }, 'end'); expect(crop).toHaveBeenCalledTimes(2);
});
it('never substitutes a first frame for an unavailable middle or end', async () => {
  const crop = vi.fn(), engine = createVideoFrameTransformer(crop), v = card();
  Reflect.deleteProperty(v, 'timeline_thumbs'); const before = structuredClone(v);
  expect(await engine.transform({ items: [v] }, 'middle')).toBe(false); expect(v).toEqual(before);
  expect(crop).not.toHaveBeenCalled();
});
it('reuses prepared video frames when search rotates signed URLs, but separates timestamps and access keys', async () => {
  const crop = vi.fn(async () => cropped), engine = createVideoFrameTransformer(crop);
  await engine.transform({ videos: [card()] }, 'middle');
  const rotated = card(); rotated.timeline_thumbs.links[0] += '?new-signature';
  await engine.transform({ videos: [rotated] }, 'middle');
  expect(crop).toHaveBeenCalledOnce(); expect(rotated.image[rotated.image.length - 1]).toEqual(cropped);
  await engine.transform({ videos: [{ ...rotated, access_key: 'other-key' }] }, 'middle');
  expect(crop).toHaveBeenCalledTimes(2);
  await engine.transform({ videos: [card()] }, 'end');
  expect(crop).toHaveBeenCalledTimes(3);
});
it('negative-caches failed image loads and preserves the original cover', async () => {
  const crop = vi.fn(async () => { throw new Error('CORS'); }), engine = createVideoFrameTransformer(crop), v = card(), before = structuredClone(v);
  expect(await engine.transform({ videos: [v] }, 'end')).toBe(false);
  await engine.transform({ videos: [v] }, 'end'); expect(crop).toHaveBeenCalledOnce(); expect(v).toEqual(before);
});
it('does not apply a late crop after disable or after the response deadline', async () => {
  let resolve!: (value: typeof cropped) => void;
  const crop = vi.fn(() => new Promise<typeof cropped>(r => { resolve = r; })), engine = createVideoFrameTransformer(crop), v = card(), before = structuredClone(v);
  const pending = engine.transform({ items: [v] }, 'middle'); await vi.waitFor(() => expect(crop).toHaveBeenCalledOnce()); engine.clear(); resolve(cropped);
  expect(await pending).toBe(false); expect(v).toEqual(before);
  let valid = true;
  const second = engine.transform({ items: [v] }, 'end', () => valid); await vi.waitFor(() => expect(crop).toHaveBeenCalledTimes(2)); valid = false; resolve(cropped);
  expect(await second).toBe(false); expect(v).toEqual(before);
});
it('caps concurrent decodes and drains the queue without dropping cards from later API responses', async () => {
  const resolves: Array<(value: typeof cropped) => void> = [];
  const crop = vi.fn(() => new Promise<typeof cropped>(r => resolves.push(r))), engine = createVideoFrameTransformer(crop);
  const cards = Array.from({ length: 5 }, (_, i) => { const v = card(); v.timeline_thumbs.links[0] += `?id=${i}`; return v; });
  const work = cards.map(v => engine.transform({ videos: [v] }, 'end'));
  await vi.waitFor(() => expect(crop).toHaveBeenCalledTimes(4)); resolves.forEach(resolve => resolve(cropped));
  await vi.waitFor(() => expect(crop).toHaveBeenCalledTimes(5)); resolves[4](cropped);
  expect((await Promise.all(work)).filter(Boolean)).toHaveLength(5);
});
