import { serializeSettings } from '@/shared/settings-export.js';
import { callVKApi, type VKTokenManager } from '../utils/vk-api.js';
import type { SettingsDocumentEntry, SettingsDocumentList } from '@/shared/settings-document.js';
import { fetchBytesLimited } from '../utils/audio-cdn.js';
import { sanitizeSettings } from '@/shared/constants/settings-schema.js';

interface VKDocument {
  id: number;
  owner_id: number;
  title: string;
  date: number;
  size: number;
  ext: string;
  tags?: string[];
  url?: string;
}

function documentError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function documentUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); }
  catch { throw documentError('VK_DOCUMENT_URL', 'VK did not return a document download URL'); }
  if (url.protocol !== 'https:' || url.username || url.password
    || !/(^|\.)(vk\.ru|userapi\.com|vkuserphoto\.ru)$/.test(url.hostname)) {
    throw documentError('VK_DOCUMENT_URL', `Unsupported document server: ${url.hostname}`);
  }
  return url;
}

function isSettingsDocument(doc: VKDocument, userId: string): boolean {
  const tags = Array.isArray(doc.tags) ? doc.tags.map(tag => String(tag).trim().toLowerCase()) : [];
  return Number.isSafeInteger(doc.id) && doc.id > 0 && String(doc.owner_id) === userId
    && doc.ext?.toLowerCase() === 'json' && tags.includes('vkify') && tags.includes('settings');
}

export async function listSettingsDocuments(tokenManager: VKTokenManager): Promise<SettingsDocumentList> {
  const users = await callVKApi(tokenManager, 'users.get') as { id: number }[];
  const userId = String(users?.[0]?.id);
  if (!/^[1-9]\d*$/.test(userId)) throw new Error('Invalid VK account');
  const documents = new Map<number, SettingsDocumentEntry>();
  let offset = 0;
  while (true) {
    const page = await callVKApi(tokenManager, 'docs.get', {
      owner_id: userId, count: 1000, offset, return_tags: 1,
    }, 0, userId) as { count: number; items: VKDocument[] };
    if (!Array.isArray(page?.items) || !Number.isSafeInteger(page.count) || page.count < 0) {
      throw new Error('Invalid VK document list');
    }
    for (const doc of page.items) {
      if (isSettingsDocument(doc, userId)) documents.set(doc.id, {
        id: doc.id, ownerId: userId, title: doc.title,
        savedAt: Number.isFinite(doc.date) ? doc.date * 1000 : 0,
        size: Number.isFinite(doc.size) ? doc.size : 0,
      });
    }
    offset += page.items.length;
    if (offset >= page.count || page.items.length === 0) break;
    await new Promise(resolve => setTimeout(resolve, 350));
  }
  return { userId, documents: [...documents.values()].sort((a, b) => b.savedAt - a.savedAt || b.id - a.id) };
}

export async function readSettingsDocument(
  tokenManager: VKTokenManager, userId: string, documentId: number,
): Promise<string> {
  if (!/^[1-9]\d*$/.test(userId) || !Number.isSafeInteger(documentId) || documentId <= 0) {
    throw new Error('Invalid VK document');
  }
  const docs = await callVKApi(tokenManager, 'docs.getById', {
    docs: `${userId}_${documentId}`, return_tags: 1,
  }, 0, userId) as VKDocument[];
  const doc = docs?.[0];
  if (!doc || doc.id !== documentId || !isSettingsDocument(doc, userId)) {
    throw documentError('VK_DOCUMENT_NOT_FOUND', 'The settings document is unavailable or its tags have changed');
  }
  const url = documentUrl(doc.url ?? '');
  let bytes: Uint8Array;
  try {
    // A document URL can redirect to the file on VK's CDN. Rejecting every
    // redirect makes a valid API download link fail before any JSON is read.
    const downloaded = await fetchBytesLimited(url.href, 32 * 1024 * 1024, { credentials: 'omit', redirect: 'follow' });
    if (downloaded.response.url) documentUrl(downloaded.response.url);
    bytes = downloaded.bytes;
  } catch (error) {
    if ((error as { code?: string }).code === 'VK_DOCUMENT_URL') throw error;
    throw documentError('VK_DOCUMENT_DOWNLOAD', (error as Error).message);
  }
  const json = new TextDecoder().decode(bytes);
  let data: { settings?: Record<string, unknown> };
  try { data = JSON.parse(json) as typeof data; }
  catch { throw documentError('VK_DOCUMENT_FORMAT', 'The downloaded document is not JSON'); }
  if (!data?.settings || typeof data.settings !== 'object' || Array.isArray(data.settings)
    || Object.keys(sanitizeSettings(data.settings, 'import')).length === 0) {
    throw documentError('VK_DOCUMENT_FORMAT', 'The document contains no supported settings');
  }
  // The account may have changed while the document was downloading.
  await callVKApi(tokenManager, 'users.get', {}, 0, userId);
  return json;
}

export interface SettingsDocument {
  url: string;
}

let pendingSave: Promise<SettingsDocument> | undefined;

/** Coalesce repeated clicks, including clicks from another popup window. */
export function saveSettingsDocument(
  tokenManager: VKTokenManager,
  settings: Record<string, unknown>,
): Promise<SettingsDocument> {
  if (pendingSave) return pendingSave;
  pendingSave = uploadSettingsDocument(tokenManager, settings).finally(() => { pendingSave = undefined; });
  return pendingSave;
}

async function uploadSettingsDocument(
  tokenManager: VKTokenManager,
  settings: Record<string, unknown>,
): Promise<SettingsDocument> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    throw new Error('Invalid settings');
  }
  const json = serializeSettings(settings);
  const users = await callVKApi(tokenManager, 'users.get') as { id: number }[];
  const userId = String(users?.[0]?.id);
  if (!/^[1-9]\d*$/.test(userId)) throw new Error('Invalid VK account');

  // No group_id: VK stores the file in the user's personal documents.
  const server = await callVKApi(tokenManager, 'docs.getUploadServer', {}, 0, userId) as { upload_url?: string };
  const uploadUrl = new URL(server.upload_url ?? '');
  if (uploadUrl.protocol !== 'https:' || uploadUrl.username || uploadUrl.password
    || !/(^|\.)(vk\.ru|userapi\.com)$/.test(uploadUrl.hostname)) {
    throw new Error('Invalid VK upload server');
  }
  const title = `vkify-settings-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const body = new FormData();
  body.append('file', new Blob([json], { type: 'application/json' }), title);
  const response = await fetch(uploadUrl.href, {
    method: 'POST', body, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`VK upload failed: HTTP ${response.status}`);
  const uploaded = await response.json() as { file?: string };
  if (typeof uploaded.file !== 'string' || !uploaded.file) throw new Error('VK did not accept the file');

  // Recheck the exact token's identity before attaching the file to a profile.
  const saved = await callVKApi(tokenManager, 'docs.save', {
    file: uploaded.file, title, tags: 'vkify,settings',
  }, 0, userId) as { doc?: { id: number; owner_id: number } };
  if (!Number.isSafeInteger(saved.doc?.id) || (saved.doc?.id ?? 0) <= 0
    || String(saved.doc?.owner_id) !== userId) throw new Error('Invalid saved VK document');
  return { url: `https://vk.ru/doc${userId}_${saved.doc!.id}` };
}
