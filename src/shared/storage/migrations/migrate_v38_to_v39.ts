import { MESSAGE_APPEARANCE_DEFAULTS, parseMessageAppearance } from '../../message-appearance.js';
import type { Migration } from './types.js';
export const migrateV38ToV39: Migration = { to: 39, description: 'Initialize message surfaces and split conversation layout',
  migrate: old => ({ ...old,
    messenger_message_background: old.messenger_message_background === true,
    messenger_modern_messages: old.messenger_modern_messages === true,
    messenger_message_settings: JSON.stringify(old.messenger_message_settings === undefined
      ? MESSAGE_APPEARANCE_DEFAULTS : parseMessageAppearance(old.messenger_message_settings)),
  }) };
