import { siteUrl } from '../../shared/constants/site.js';

// Social links — never environment-dependent.
export const SOCIAL_LINKS = [
  { id: 'telegram', label: 'Telegram', url: 'https://t.me/VKify', variant: 'telegram' },
  { id: 'vk', label: 'Группа VK', url: 'https://vk.com/vkify', variant: 'vk' },
  { id: 'github', label: 'GitHub', url: 'https://github.com/rianvy/vkify', variant: 'default' },
  { id: 'donate', label: 'Поддержать', url: 'https://pay.cloudtips.ru/p/b59e1765', variant: 'donate' },
] as const;

// Companion-site URLs — resolved at build time (prod: vkify.ru, dev: localhost).
export const WEBSITE_URL: string = siteUrl('/');
export const WALLPAPERS_URL: string = siteUrl('/wallpapers');