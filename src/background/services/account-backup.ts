import { callVKApi, VKTokenManager } from '../utils/vk-api.js';
import { buildZip } from '../../shared/utils/zip.js';
import { ApiQueue } from '../../content/core/api/rate-limiter.js';
import { bytesToBase64 } from '../utils/base64.js';
import { sanitizeFilename } from '../../shared/utils/filename.js';
import type { ZipEntry } from '../../shared/utils/zip.js';
import {
  ACCOUNT_BACKUP_STATE_KEY,
  type AccountBackupOptions,
  type AccountBackupSection,
  type AccountBackupState,
} from '../../shared/account-backup.js';

interface PageResponse { count?: number; items?: unknown[] }
interface BackupDocument {
  version: 1;
  exportedAt: string;
  userId: string | null;
  sections: Partial<Record<AccountBackupSection, unknown>>;
  errors: Partial<Record<AccountBackupSection, string>>;
}

interface MediaCandidate { url: string; path: string }

const PAGE_SIZES: Partial<Record<AccountBackupSection, number>> = {
  wall: 100, photos: 200, videos: 200, docs: 200, notes: 100, gifts: 100,
  subscriptions: 500, friends: 5000,
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
const DB_NAME = 'vkify-account-backup';
const STORE_NAME = 'results';

function openBackupDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('BACKUP_DB_OPEN_FAILED'));
  });
}

async function writeStoredResult(value: { blob: Blob; filename: string } | null): Promise<void> {
  const db = await openBackupDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    value ? store.put(value, 'latest') : store.delete('latest');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('BACKUP_DB_WRITE_FAILED'));
  });
  db.close();
}

async function readStoredResult(): Promise<{ blob: Blob; filename: string } | null> {
  const db = await openBackupDb();
  const value = await new Promise<unknown>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('latest');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('BACKUP_DB_READ_FAILED'));
  });
  db.close();
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { blob?: unknown; filename?: unknown };
  return candidate.blob instanceof Blob && typeof candidate.filename === 'string'
    ? { blob: candidate.blob, filename: candidate.filename }
    : null;
}

export class AccountBackupService {
  private cancelled = false;
  private running = false;
  private result: { blob: Blob; filename: string } | null = null;
  private readonly queue = new ApiQueue({ concurrency: 1, maxRetries: 3, retryBaseMs: 750 });

  constructor(private readonly tokenManager: VKTokenManager) {}

  async getState(): Promise<AccountBackupState> {
    const stored = await chrome.storage.local.get(ACCOUNT_BACKUP_STATE_KEY);
    return (stored[ACCOUNT_BACKUP_STATE_KEY] as AccountBackupState | undefined) ?? {
      status: 'idle', progress: 0, completedSections: [], errors: {},
    };
  }

  async start(options: AccountBackupOptions): Promise<void> {
    if (this.running) throw new Error('BACKUP_ALREADY_RUNNING');
    if (options.sections.length === 0) throw new Error('BACKUP_NOTHING_SELECTED');
    this.running = true;
    this.cancelled = false;
    this.result = null;
    const state: AccountBackupState = {
      status: 'running', progress: 0, completedSections: [], errors: {}, startedAt: Date.now(),
    };

    try {
      await writeStoredResult(null);
      await this.saveState(state);
      const token = await this.tokenManager.get();
      const doc: BackupDocument = {
        version: 1,
        exportedAt: new Date().toISOString(),
        userId: token.userId,
        sections: {},
        errors: state.errors,
      };

      for (let index = 0; index < options.sections.length; index++) {
        this.assertNotCancelled();
        const section = options.sections[index];
        state.currentSection = section;
        state.progress = Math.round(index / options.sections.length * 100);
        await this.saveState(state);
        try {
          doc.sections[section] = await this.fetchSection(section, token.userId, pageProgress => {
            state.progress = Math.min(99, Math.round((index + pageProgress) / options.sections.length * 100));
            void this.saveState(state);
          });
        } catch (error) {
          if (this.cancelled) throw error;
          const message = error instanceof Error ? error.message : String(error);
          state.errors[section] = message;
          doc.errors[section] = message;
        }
        state.completedSections.push(section);
      }

      this.assertNotCancelled();
      const stamp = new Date().toISOString().slice(0, 10);
      const json = JSON.stringify(doc, null, 2);
      const filename = `vkify-backup-${token.userId ?? 'account'}-${stamp}.${options.format}`;
      let mediaEntries: ZipEntry[] = [];
      let mediaManifest: { downloaded: string[]; skipped: { path: string; reason: string }[] } | undefined;
      if (options.format === 'zip' && options.includeMedia) {
        state.currentSection = undefined;
        await this.saveState(state);
        const media = await this.downloadMedia(doc.sections);
        mediaEntries = media.entries;
        mediaManifest = { downloaded: media.entries.map(entry => entry.name), skipped: media.skipped };
      }
      const blob = options.format === 'zip'
        ? buildZip([
            { name: 'backup.json', data: json },
            { name: 'README.txt', data: options.includeMedia
              ? 'VKify account backup. Downloaded media is in the media directory; unavailable files remain available by URL in JSON.\n'
              : 'VKify account backup. Media objects retain their original VK/CDN URLs.\n' },
            ...Object.entries(doc.sections).map(([name, data]) => ({
              name: `data/${name}.json`, data: JSON.stringify(data, null, 2),
            })),
            ...(mediaManifest ? [{ name: 'media/manifest.json', data: JSON.stringify(mediaManifest, null, 2) }] : []),
            ...mediaEntries,
          ])
        : new Blob([json], { type: 'application/json' });
      this.result = { blob, filename };
      await writeStoredResult(this.result);
      Object.assign(state, {
        status: 'completed', progress: 100, currentSection: undefined,
        completedAt: Date.now(), filename,
      });
      await this.saveState(state);
    } catch (error) {
      if (this.cancelled) {
        Object.assign(state, { status: 'cancelled', currentSection: undefined });
      } else {
        Object.assign(state, {
          status: 'failed', currentSection: undefined,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      await this.saveState(state);
    } finally {
      this.running = false;
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    const state = await this.getState();
    if (state.status === 'running') {
      await this.saveState({ ...state, status: 'cancelled', currentSection: undefined });
    }
  }

  async download(): Promise<void> {
    const result = this.result ?? await readStoredResult();
    if (!result) throw new Error('BACKUP_RESULT_UNAVAILABLE');
    this.result = result;
    // URL.createObjectURL недоступен в MV3 service worker. Data URL работает
    // одинаково в Chromium и Firefox и передаётся штатному downloads API.
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    const mime = result.blob.type || 'application/octet-stream';
    const url = `data:${mime};base64,${bytesToBase64(bytes)}`;
    await chrome.downloads.download({ url, filename: result.filename, saveAs: true });
  }

  private async fetchSection(section: AccountBackupSection, userId: string | null, progress: (value: number) => void): Promise<unknown> {
    if (section === 'profile') {
      progress(1);
      return this.api('users.get', { fields: 'photo_max_orig,screen_name,sex,bdate,city,country,status,contacts,counters' });
    }
    if (section === 'photos') {
      const albums = await this.paginate('photos', 'photos.getAlbums', { need_system: 1, need_covers: 1 }, () => undefined);
      const photos = await this.paginate('photos', 'photos.getAll', { extended: 1, photo_sizes: 1 }, progress);
      return { albums, items: photos };
    }
    const definitions: Record<Exclude<AccountBackupSection, 'profile' | 'photos'>, [string, Record<string, unknown>]> = {
      wall: ['wall.get', { extended: 1 }],
      videos: ['video.get', { extended: 1, ...(userId ? { owner_id: userId } : {}) }],
      docs: ['docs.get', {}],
      notes: ['notes.get', {}],
      gifts: ['gifts.get', {}],
      subscriptions: ['groups.get', { extended: 1, fields: 'photo_200,screen_name,members_count' }],
      friends: ['friends.get', { fields: 'photo_200,screen_name,sex,bdate,city,country' }],
    };
    const [method, params] = definitions[section];
    return this.paginate(section, method, params, progress);
  }

  private async paginate(section: AccountBackupSection, method: string, params: Record<string, unknown>, progress: (value: number) => void): Promise<unknown[]> {
    const count = PAGE_SIZES[section] ?? 100;
    const items: unknown[] = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;
    while (offset < total) {
      this.assertNotCancelled();
      const response = await this.api(method, { ...params, count, offset }) as PageResponse;
      const page = Array.isArray(response?.items) ? response.items : [];
      total = typeof response?.count === 'number' ? response.count : page.length;
      items.push(...page);
      offset += page.length;
      progress(total > 0 ? Math.min(1, items.length / total) : 1);
      if (page.length === 0 || page.length < count) break;
    }
    return items;
  }

  private async api(method: string, params: Record<string, unknown>): Promise<unknown> {
    return this.queue.run(async () => {
      this.assertNotCancelled();
      const value = await callVKApi(this.tokenManager, method, params);
      await delay(350);
      return value;
    });
  }

  private async downloadMedia(sections: BackupDocument['sections']): Promise<{
    entries: ZipEntry[];
    skipped: { path: string; reason: string }[];
  }> {
    const candidates = this.collectMedia(sections);
    const entries: ZipEntry[] = [];
    const skipped: { path: string; reason: string }[] = [];
    for (const candidate of candidates) {
      this.assertNotCancelled();
      try {
        const response = await fetch(candidate.url, { credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        entries.push({ name: candidate.path, data: new Uint8Array(await response.arrayBuffer()) });
      } catch (error) {
        skipped.push({ path: candidate.path, reason: error instanceof Error ? error.message : String(error) });
      }
    }
    return { entries, skipped };
  }

  private collectMedia(sections: BackupDocument['sections']): MediaCandidate[] {
    const result: MediaCandidate[] = [];
    const seen = new Set<string>();
    const add = (url: unknown, path: string): void => {
      if (typeof url !== 'string' || !/^https:\/\//i.test(url) || seen.has(url)) return;
      seen.add(url);
      result.push({ url, path });
    };
    const records = (value: unknown): Record<string, unknown>[] =>
      Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object') : [];

    const photoSection = sections.photos as { items?: unknown[] } | undefined;
    for (const photo of records(photoSection?.items)) {
      const sizes = records(photo.sizes);
      sizes.sort((a, b) => Number(a.width ?? 0) * Number(a.height ?? 0) - Number(b.width ?? 0) * Number(b.height ?? 0));
      const largest = sizes[sizes.length - 1];
      const url = largest?.url;
      const ext = this.extensionFromUrl(url, 'jpg');
      add(url, `media/photos/photo_${String(photo.owner_id ?? 'user')}_${String(photo.id ?? result.length)}.${ext}`);
    }

    for (const doc of records(sections.docs)) {
      const ext = typeof doc.ext === 'string' ? doc.ext.replace(/[^a-z0-9]/gi, '') : this.extensionFromUrl(doc.url, 'bin');
      const title = sanitizeFilename(String(doc.title ?? `document_${String(doc.id ?? result.length)}`));
      add(doc.url, `media/documents/${title}_${String(doc.id ?? result.length)}.${ext || 'bin'}`);
    }

    for (const video of records(sections.videos)) {
      const files = video.files && typeof video.files === 'object' ? video.files as Record<string, unknown> : {};
      const choices = Object.entries(files)
        .filter(([key, value]) => /^mp4_\d+$/.test(key) && typeof value === 'string')
        .sort(([a], [b]) => Number(a.slice(4)) - Number(b.slice(4)));
      const best = choices[choices.length - 1];
      if (best) {
        const title = sanitizeFilename(String(video.title ?? `video_${String(video.id ?? result.length)}`));
        add(best[1], `media/videos/${title}_${String(video.id ?? result.length)}.mp4`);
      }
    }
    return result;
  }

  private extensionFromUrl(value: unknown, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    try {
      const match = new URL(value).pathname.match(/\.([a-z0-9]{2,5})$/i);
      return match?.[1]?.toLowerCase() ?? fallback;
    } catch {
      return fallback;
    }
  }

  private assertNotCancelled(): void {
    if (this.cancelled) throw new Error('BACKUP_CANCELLED');
  }

  private async saveState(state: AccountBackupState): Promise<void> {
    await chrome.storage.local.set({ [ACCOUNT_BACKUP_STATE_KEY]: { ...state } });
  }
}
