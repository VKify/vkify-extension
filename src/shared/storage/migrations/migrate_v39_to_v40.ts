import { parseMessageAppearance } from '../../message-appearance.js';
import type { Migration } from './types.js';
export const migrateV39ToV40: Migration = { to: 40, description: 'Prefer theme colors for message backgrounds',
  migrate: old => ({ ...old, messenger_message_settings: JSON.stringify(parseMessageAppearance(old.messenger_message_settings)) }) };
