/** Origins used by the background HLS loader, including playlists and AES keys. */
export const AUDIO_HOST_DOMAINS = [
  'vk.ru', 'vkuseraudio.net', 'vkuseraudio.ru', 'userapi.com', 'mycdn.me', 'vkuser.net', 'vk-cdn.net',
];
export const AUDIO_HOST_ORIGINS = AUDIO_HOST_DOMAINS.map(host => `https://*.${host}/*`);

/** Check and request the same set so partial Firefox grants keep the banner visible. */
export const VK_BACKGROUND_HOST_ORIGINS = [
  ...AUDIO_HOST_ORIGINS,
  'https://vkvideo.ru/*',
  'https://*.vkvideo.ru/*',
  'https://api.vk.ru/*',
  'https://*.vkuserphoto.ru/*',
];
