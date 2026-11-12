import { cssFeature, derivedCssFeature } from '@/content/core/features/index.js';
import { messageAppearanceSurfaces, parseMessageAppearance } from '@/shared/message-appearance.js';

export const modernMessagesFeature = cssFeature({ id: 'messenger_modern_messages', name: 'Сообщения по сторонам',
  category: 'messages', cssFiles: 'center/messages/modern-messages.css' });

export const messageBackgroundFeature = derivedCssFeature({ id: 'messenger_message_background', name: 'Фон сообщений',
  category: 'messages', watch: ['messenger_message_settings'], reapplyOnUpdate: true,
  cssFiles: 'center/messages/message-background.css', compute: settings => {
    if (settings.messenger_message_background !== true) return null;
    const config = parseMessageAppearance(settings.messenger_message_settings);
    const surfaces = messageAppearanceSurfaces(config);
    return { vars: {
      // Theme variables must resolve inside the conversation, not on <html>:
      // VK can use a light root palette and a dark body/conversation palette.
      '--vkify-message-in': config.source === 'custom' ? surfaces.incoming : 'initial',
      '--vkify-message-out': config.source === 'custom' ? surfaces.outgoing : 'initial',
      '--vkify-message-in-text': config.source === 'custom' ? surfaces.incomingText : 'initial',
      '--vkify-message-out-text': config.source === 'custom' ? surfaces.outgoingText : 'initial',
      '--vkify-message-opacity': `${config.opacity}%`,
      '--vkify-message-radius': `${config.radius}px`,
    } };
  } });
