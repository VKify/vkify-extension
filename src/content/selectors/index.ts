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

    // ── Детект активного диалога (peer.ts фич pin-note / templates) ──────────
    // Шапка чата Messenger Engine.
    convoHeader:     '.ConvoHeader',
    // Avatar-ссылка в шапке (`/id100`, `/club…`) — источник peer_id.
    convoHeaderInfo: ['.ConvoHeader__info', 'a[class*="ConvoHeader__info"]'],
    // Заголовок чата ВНУТРИ шапки (descendant-форма, pin-note/peer.ts).
    convoTitle:      ['.ConvoHeader .ConvoTitle__author', '.ConvoHeader .PeerTitle__title'],
    // Заголовок чата относительно уже найденной шапки (templates/peer.ts).
    convoTitleInner: ['.ConvoTitle__author', '.PeerTitle__title'],
    // Заголовок чата в прочих версиях разметки (fallback вне ConvoHeader).
    dialogHeaderTitle: ['[data-testid="im_dialog_header_title"]',
                        '[class*="ChatHeaderTitle__title"]', '[class*="DialogHeader__title"]'],
    // Обёртка VirtualScrollItem с conversation_message_id (data-itemkey).
    itemKey:  '[data-itemkey]',
    // Прочие носители cmid — ИСПОЛЬЗУЕТСЯ КАК UNION (querySelectorAll напрямую),
    // не через queryAll: extractCmid собирает кандидатов из всех трёх атрибутов.
    cmidAttrs: '[data-cmid], [data-msgid], [data-message-id]',
    // Кнопка «Ещё» в шапке чата — якорь вставки кнопки экспорта (dialog-export).
    convoMoreMenuTrigger: '#convo-more-menu-trigger',
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
    // Корень нижнего плеера. Новый web2-плеер сменил класс .AudioPlayerBlock__root
    // на testid-обёртки — без них playerToEntry() не находил трек и скачивание из
    // плеера переставало работать. Держим старый класс + новые testid как фолбэки.
    player:       ['.AudioPlayerBlock__root',
                   '[data-testid="AudioPlayerBlock_LayoutGroups"]',
                   '[data-testid="AudioLayer_PlayerBlock"]'],
    vkuiTitle:    'a[data-testid="MusicTrackRow_Title"]',
    vkuiAuthors:  'a[data-testid="MusicTrackRow_Authors"]',
    vkuiCover:    '[data-testid="MusicTrackRow_PlaybackControls"] img',
    // Текущий трек из нижнего плеера (используется music/dom.ts → playerToEntry).
    playerTitle:   'a[data-testid="AudioPlayerBlock_AudioTitle"]',
    playerAuthors: 'a[data-testid="AudioPlayerBlock_Authors"]',
    playerCover:   '[data-testid="AudioPlayerBlock_AudioCover"] img',

    // ── Классическая строка `.audio_row` — якоря для кнопки «⬇» (controls.ts).
    rowDuration: ['._audio_row__duration', '.audio_row__duration'],
    rowInfo:     ['._audio_row__info', '.audio_row__info'],
    rowMore:     ['._audio_row__action_more', '.audio_row__action_more'],

    // ── Новая VKUI-строка (классы хешированы → ищем по подстроке).
    vkuiRoot:     '[class*="vkitAudioRow__root"]',
    vkuiActions:  ['[data-testid="audiorow-actions"] [role="group"]', '[class*="vkitAudioRow__buttonGroup"]'],
    vkuiAfter:    '[class*="vkitAudioRow__after"]',
    vkuiDuration: '[data-testid="MusicTrackRow_Duration"]',

    // Контейнер кнопок нижнего плеера (контейнер хеширован …__audioButtons--XXXX).
    playerButtons: '[class*="vkitAudioPlayerPlaybackBody__audioButtons"] [role="group"]',

    // ── Модалка альбома / плейлиста (массовое скачивание, bulk.ts).
    albumModal:        '[data-testid="MusicPlaylistModal"]',
    albumModalTitle:   '[data-testid="MusicPlaylistModal_Title"]',
    albumTracksHeader: '[data-testid="MusicPlaylistTracks_Header"]',
    albumCoverBg:      '[data-testid="audiolistboxheader-cover"] [style*="background-image"]',
    albumCoverImg:     '[data-testid="audiolistboxheader-cover"] img',
    albumExpandBtn:    '[data-testid="audiolistitems-expandbutton"]',
    albumLink:         'a[href*="/music/album/"]',

    // Нативная кнопка загрузки аудио — якорь кнопки мультизагрузки (multi-upload.ts).
    // Тулбар «Скачать всё» — см. SELECTORS.common.headerAsideGroup.
    uploadVkBtn: '[data-testid="AudioCatalogUploadAudioAction"]',
  },

  // Лента: маркеры рекламы (DOM-блокировщик, ads-blocking/feed-dom.ts).
  feed: {
    // Кнопка «Рекламная запись» в шапке поста — нативная реклама VK.
    nativeAdButton: '[data-testid="post-header-subscription-button"]',
  },

  // Шапка сайта / логотип VK (appearance/theme/feature.ts — перекраска лого).
  header: {
    // Контейнеры SVG-логотипа — UNION (querySelectorAll по всем версиям сразу).
    logoSvg: '[class*="Logo__root"] svg, .TopHomeLink svg, a[class*="Logo"] svg',
    // Шапка сайта — цель MutationObserver перекраски лого. Сам observer НЕ
    // мигрируем (узко наблюдает поддерево хедера), централизуем лишь селектор.
    bar: '#page_header_wrap, header, #top_nav',
  },

  // Друзья: кнопка «Добавить в друзья» (automation/auto-add-friends.ts).
  friends: {
    // Кандидаты кнопки — UNION-строка (querySelectorAll), затем фильтр по тексту
    // («добавить» / «добавить в друзья») и .closest('button').
    addButtonCandidates: 'span.vkuiButton__content, button[class*="Button"]',
  },

  // Просмотр фото (#pv_box) и страницы альбомов (photo/buttons.ts, photo/api.ts).
  photo: {
    viewer:          '#pv_box',
    viewerActions:   '.pv_bottom_actions',
    viewerMore:      '.pv_actions_more',
    // Носители photo-id в просмотрщике (класс `_like_photo<o>_<id>` / data-options).
    viewerLikeWrap:  ['#pv_box .like_wrap', '#pv_box [class*="_like_photo"]'],
    viewerPhotoData: '#pv_box [data-task-click="Page/owner_set_exist_photo"]',
    // Классическая страница альбома (#photos_all_block) — нет headerlayout-aside.
    classicAlbumBlock:  '#photos_all_block',
    classicHeaderExtra: ['.page_block_header_extra', '._header_extra'],
    classicReverseBtn:  '.photos_album_reverse_btn',
  },

  // Плеер историй (story/ui.ts).
  story: {
    // Иконка «⋯» в шапке активной сторис (галерея) — родитель = панель действий.
    menuIconInSelected: '[data-testid="stories-gallery-selected-item"] [data-testid="stories_viewer_menu_icon"]',
    // Иконка «⋯» внутри уже найденной панели действий.
    menuIcon: '[data-testid="stories_viewer_menu_icon"]',
  },

  // Лента клипов (clip/ui.ts, clip/api.ts).
  clip: {
    // Карточка клипа со snap-key `<owner>_<id>`.
    snapKey:         '[data-snap-key]',
    // Контейнер активного плеера внутри карточки (класс хеширован).
    playerContainer: '[class*="vkitClipPlayerContainer__playerContainer"]',
    feedControls:    '[data-testid="clips-feed-controls"]',
    roundedGroup:    '[data-testid="roundedgroup"]',
    likeButton:      '[data-testid="clips-controls-like-button"]',
  },

  // Поля ввода / композеры сообщений во ВСЕХ версиях UI VK — точки инжекта
  // кнопки шифрования (privacy/crypto/message-crypto.ts → findComposers).
  composer: {
    // 1. IM Messenger (VKUI).
    imPanel:       '.ConvoComposer__inputPanel',
    imInput:       ['.ComposerInput__input[contenteditable="true"]', '[contenteditable="true"][data-placeholder]'],
    imEmojiAnchor: '.StickerEmojiMenuPopper',
    imSendButton:  'button[class*="sendButton"]',
    // 2. Классический IM (im.php). UNION-строка (querySelectorAll по всем трём
    //    панелям сразу), НЕ queryAll — иначе потеряются параллельные варианты.
    classicImPanel: '._im_controls, .im-chat-input--buttons, ._im_chat_input_parent',
    classicImInput: ['._im_text', '.im-chat-input--text-box'],
    // 3. Ответ в топике (Board, классический интерфейс).
    boardReplyWrap:  '.reply_field_wrap',
    boardReplyInput: '.reply_field[contenteditable="true"]',
    boardEmojiWrap:  '.emoji_smile_wrap',
    boardEmojiBtn:   '.emoji_smile',
    // 4. VKUI-комментарий к стене.
    commentContainer:    '[class*="vkitCommentInput__container"]',
    commentInput:        '[data-testid="content-editable-input"]',
    commentAfterButtons: '[class*="vkitCommentInputContentEditable__afterButtons"]',
    commentEmojiWrap:    '._emoji_wrap',
    commentEmojiSmile:   '[data-testid="emoji-smile"]',
    // 5. VKUI-пост (создание поста на стене).
    postWrapper:   '[class*="PostInputWithEmoji__messageInputWrapper"]',
    postInput:     ['[data-testid="posting_base_screen_input_message"]', '[contenteditable="true"]'],
    postEmojiWrap: '[class*="PostInputWithEmoji__emojiWrapper"]',
    postEmojiBtn:  ['._emoji_btn', '.emoji_smile'],
  },

  // Плавающий мини-чат (Floating Chat) — список диалогов с абсолютно
  // позиционированными элементами (privacy/dialogs/fc-list-reflow.ts).
  floatingChat: {
    // Кнопка-строка одного диалога (несёт aria-label = имя собеседника).
    listItem: '.FCConvoListItem',
    // Скролл-контейнер списка. Атрибут общий — отбираем те, что содержат listItem.
    scrollContent: '[data-scrollbar="content"]',
  },

  // Левое меню VK — пункты навигации (data-testid="leftmenuitem").
  menu: {
    // Ссылка пункта «Сообщества» для редиректа на «Мои сообщества».
    // ВАЖНО: id="l_gr" / data-testid="leftmenuitem" сидят на <li>, а реальная
    // навигационная ссылка — вложенный <a href="/groups">. Кандидаты: точный
    // href → любой <a> внутри пункта → фолбэк по data-testid (на случай смены id).
    groups: ['#l_gr a[href="/groups"]', '#l_gr a', '[data-testid="leftmenuitem"] a[href="/groups"]'],
  },

  // Кросс-доменные якоря, общие для нескольких фич.
  common: {
    // Тулбар в шапке VKUI-страниц — якорь кнопок «Скачать всё»
    // (раздел музыки /audios<owner> и страницы фото-альбомов).
    headerAsideGroup: ['[data-testid="headerlayout-aside"] [role="group"]',
                       '[data-testid="headerlayout-aside"] .vkuiButtonGroup__host'],
  },

  // Разделы ниже мигрируют инкрементально — добавляются по мере рефакторинга.
  // feed: { ... }, sidebar: { ... }, profile: { ... }
} as const satisfies Record<string, SelectorGroup>;

export type { SelectorSpec, SelectorGroup, SelectorEntry, DynamicSelector } from './types.js';
export { isDynamicSelector } from './types.js';
