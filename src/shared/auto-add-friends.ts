import { normalizeUserIds } from './user-lists.js';
export const AUTO_ADD_STATE = 'auto_add_stats';
export const AUTO_ADD_ALARM = 'autoAddFriends';
export const AUTO_ADD_LEDGER = 'auto_add_ledger';
// Local ceilings, not a guarantee of VK's account-specific anti-abuse limits.
export const AUTO_ADD_CAPS = { hour: 20, day: 50, session: 20, delayMin: 30, delayMax: 600, friends: 10000, outgoing: 1000 };
export interface AutoAddOptions { hour: number; day: number; session: number; delayMin: number; delayMax: number }
export const AUTO_ADD_DEFAULTS: AutoAddOptions = { hour: 10, day: 25, session: 10, delayMin: 60, delayMax: 120 };
export type AutoAddSource = { kind: 'recommendations' } | { kind: 'list'; ids: number[]; name?: string; ownerId?: string };
export function normalizeAutoAddSource(value: unknown): AutoAddSource {
  if (value === undefined) return { kind: 'recommendations' };
  const s = value as AutoAddSource;
  if (s?.kind === 'recommendations') return { kind: 'recommendations' };
  if (s?.kind !== 'list' || (s.ownerId !== undefined && !/^[1-9]\d*$/.test(s.ownerId))) throw new Error('INVALID_SOURCE');
  return { kind: 'list', ids: normalizeUserIds(s.ids), name: typeof s.name === 'string' ? s.name.slice(0, 100) : undefined, ownerId: s.ownerId };
}
export interface AutoAddState {
  isRunning: boolean;
  added: number;
  attempted: number;
  userId?: string;
  options?: AutoAddOptions;
  nextAt?: number;
  inFlight?: boolean;
  reason?: string;
  error?: string;
  code?: string;
  hourUsed?: number;
  dayUsed?: number;
  source?: AutoAddSource;
  cursor?: number;
}
export function validAutoAddOptions(value: unknown): value is AutoAddOptions {
  if (!value || typeof value !== 'object') return false;
  const o = value as AutoAddOptions;
  return Number.isInteger(o.hour) && o.hour >= 1 && o.hour <= AUTO_ADD_CAPS.hour
    && Number.isInteger(o.day) && o.day >= 1 && o.day <= AUTO_ADD_CAPS.day
    && Number.isInteger(o.session) && o.session >= 1 && o.session <= AUTO_ADD_CAPS.session
    && Number.isInteger(o.delayMin) && o.delayMin >= AUTO_ADD_CAPS.delayMin
    && Number.isInteger(o.delayMax) && o.delayMax >= o.delayMin && o.delayMax <= AUTO_ADD_CAPS.delayMax;
}
