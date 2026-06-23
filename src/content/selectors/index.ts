import type { SelectorGroup } from './types.js';

/**
 * Централизованный реестр CSS-селекторов VK. Единственное место, которое
 * правится при редизайне VK. Группы добавляются по мере миграции фич —
 * сюда переносятся литералы, до сих пор разбросанные по features/.
 *
 * Правила:
 *  - порядок кандидатов: точный класс → `[class*="..."]` фолбэк;
 *  - НЕ хранить здесь динамические/составные селекторы с подстановкой —
 *    только статические константы.
 */
export const SELECTORS = {
  messages: {
    block:    '.ConvoHistory__messageBlock',
    text:     ['.ConvoMessageWithoutBubble__text', '.ConvoMessageBubble__text',
               '[class*="MessageBubble__text"]', '[class*="Message__text"]'],
    infoRow:  ['.ConvoMessageInfoWithoutBubbles', '[class*="ConvoMessageBubble__info"]',
               '[class*="MessageInfo"]', '[class*="Message__info"]'],
    content:  ['.ConvoMessageWithoutBubble__content', '[class*="MessageBubble__content"]'],
    author:   ['.ConvoMessageHeader__authorLink .PeerTitle__title',
               '[class*="MessageHeader"] [class*="PeerTitle__title"]',
               '[class*="MessageHeader"] [class*="__author"]'],
    date:     ['.ConvoMessageInfoWithoutBubbles__date', '[class*="__date"]'],
    // Панель действий в шапке чата — якорь для кнопки экспорта диалога.
    headerControls: '.ConvoHeader__controls',
  },

  // Текстовые контейнеры сообщений во ВСЕХ версиях UI (IM / стена / комментарии /
  // топики). Используется с UNION-семантикой (specUnion) — авторасшифровка должна
  // ловить сообщение в любом из интерфейсов одновременно.
  crypto: {
    messageText: [
      // IM Messenger (VKUI)
      '[class*="ConvoMessage__text"]', '[class*="ConvoMessage__body"]',
      '[class*="ConvoMessageWithoutBubble__text"]', '.MessageText',
      '[class*="MessageContent__text"]', '[class*="MessageContent__body"]',
      '[data-testid="message-content-text"]', '[data-testid="message-text"]',
      // Классический IM (im.php)
      '.im_msg_text', '.message_text',
      // Стена / новости (VKUI + классика)
      '[class*="FeedPostText__root"]', '[class*="FeedShowMoreText__text"]',
      '[data-testid="showmoretext"]', '.wall_post_text', '.pi_text',
      // Комментарии (VKUI + классика)
      '[class*="CommentText"]', '[class*="ReplyComment__text"]',
      '[data-testid="wall_comment_text"]', '.wall_reply_text', '.reply_text',
      // Топики (Board)
      '.bp_text',
    ],
  },

  music: {
    rowWithId:    ['.audio_row[data-full-id]', '._audio_row[data-full-id]',
                   '[class*="AudioRow_root"][data-full-id]', '[class*="AudioRow__root"][data-full-id]'],
    rowActions:   ['._audio_row__actions', '.audio_row__actions'],
    rowPerformer: ['._audio_row__performers', '.audio_row__performers'],
    rowTitle:     ['._audio_row__title_inner', '.audio_row__title_inner',
                   '._audio_row__title', '.audio_row__title'],
    rowCover:     ['img.audio_row__cover', 'img._audio_row__cover'],
    player:       '.AudioPlayerBlock__root',
    vkuiTitle:    'a[data-testid="MusicTrackRow_Title"]',
    vkuiAuthors:  'a[data-testid="MusicTrackRow_Authors"]',
    vkuiCover:    '[data-testid="MusicTrackRow_PlaybackControls"] img',
  },

  // Разделы ниже мигрируют инкрементально — добавляются по мере рефакторинга.
  // feed: { ... }, sidebar: { ... }, profile: { ... }
} as const satisfies Record<string, SelectorGroup>;

export type { SelectorSpec, SelectorGroup } from './types.js';
