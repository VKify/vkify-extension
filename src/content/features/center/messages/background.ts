import { derivedCssFeature } from '@/content/core/features/index.js';
import { messengerBackgroundLayers, parseMessengerBackground } from '@/shared/messenger-background.js';

export const messengerBackgroundFeature = derivedCssFeature({
  id: 'messenger_background', name: 'Фон переписки', category: 'messages',
  watch: ['messenger_background_settings'], reapplyOnUpdate: true,
  cssFiles: 'center/messages/background.css',
  compute: settings => {
    if (settings.messenger_background !== true) return null;
    const background = parseMessengerBackground(settings.messenger_background_settings);
    const layers = messengerBackgroundLayers(background);
    return { vars: {
      '--vkify-chat-color': layers.color,
      '--vkify-chat-image': layers.image,
      '--vkify-chat-filter': layers.filter,
      '--vkify-chat-overlay': layers.overlay,
      '--vkify-chat-opacity': String(background.opacity / 100),
      '--vkify-chat-scale': String(background.scale / 100),
      '--vkify-chat-blur': `${background.blur}px`,
      '--vkify-chat-position': background.position,
      '--vkify-chat-size': background.size,
    } };
  },
});
