import { tupleArtwork } from '@/shared/music-artwork.js';

export interface QueueTrack { id: string; title: string; artist: string; cover: string }
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;

/** VK exposes tuples in the legacy player and audio objects in newer queue adapters. */
export function queueTrack(value: unknown, depth = 0): QueueTrack | null {
  if (depth > 1) return null;
  if (Array.isArray(value)) {
    if (value.length < 5 || !Number.isFinite(Number(value[0])) || !Number.isFinite(Number(value[1]))) return null;
    return { id: `${value[1]}_${value[0]}`, title: String(value[3] ?? '').slice(0, 500), artist: String(value[4] ?? '').slice(0, 500), cover: tupleArtwork(value) };
  }
  const item = record(value);
  if (!item) return null;
  if (item.audio && item.audio !== value) return queueTrack(item.audio, depth + 1);
  const id = item.fullId ?? item.full_id ?? (item.owner_id != null && item.id != null ? `${item.owner_id}_${item.id}` : null);
  if (typeof id !== 'string' || !/^-?\d+_\d+$/.test(id) || typeof item.title !== 'string') return null;
  return { id, title: item.title.slice(0, 500), artist: String(item.artist ?? item.performer ?? '').slice(0, 500), cover: '' };
}

function read(owner: RecordValue, method: string): unknown {
  try { const fn = owner[method]; return typeof fn === 'function' ? fn.call(owner) : undefined; } catch { return undefined; }
}

/** Re-read the current queue on every snapshot, including switches with the same current track. */
export function readNextTrack(value: unknown, currentId: string | undefined): QueueTrack | null {
  const player = record(value);
  if (!player || !currentId) return null;
  const direct = queueTrack(read(player, 'getNextAudio'));
  if (direct) return direct;
  // A sequential list cannot predict shuffled playback. Do not invent the next track.
  if (player._isShuffle === true || player._shuffle === true) return null;
  const playlist = read(player, 'getCurrentPlaylist') ?? player._currentPlaylist;
  const object = record(playlist);
  const items = Array.isArray(playlist) ? playlist : object
    ? read(object, 'getAudios') ?? object.audios ?? object.list ?? object.items ?? object.tracks : null;
  if (!Array.isArray(items)) return null;
  const index = items.findIndex(item => queueTrack(item)?.id === currentId);
  return index >= 0 && index + 1 < items.length ? queueTrack(items[index + 1]) : null;
}
