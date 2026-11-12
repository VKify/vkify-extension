import { DEFAULT_MESSENGER_BACKGROUND, parseMessengerBackground } from '../../messenger-background.js';
import type { Migration } from './types.js';

export const migrateV37ToV38: Migration = {
  to: 38, description: 'Initialize conversation wallpaper settings',
  migrate: old => ({
    ...old,
    messenger_background: old.messenger_background === true,
    messenger_background_settings: JSON.stringify(old.messenger_background_settings === undefined
      ? DEFAULT_MESSENGER_BACKGROUND : parseMessengerBackground(old.messenger_background_settings)),
  }),
};
