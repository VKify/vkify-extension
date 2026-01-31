const FEATURES = {
  // ==================
  // ВНЕШНИЙ ВИД
  // ==================
  appearance: {
    widescreen: {
      id: 'style_widescreen',
      name: { ru: 'Расширенный режим', en: 'Widescreen Mode' },
      category: 'appearance',
      default: false
    },
    contentWidth: {
      id: 'content_width',
      name: { ru: 'Ширина контента', en: 'Content Width' },
      category: 'appearance',
      default: 0, // 0 = авто, иначе значение в px
      type: 'range',
      min: 0,
      max: 1600,
      step: 50
    },
    minimalisticSidebar: {
      id: 'minimalistic_sidebar',
      name: { ru: 'Компактное меню', en: 'Compact Sidebar' },
      category: 'appearance',
      default: false
    },
    fixedSidebar: {
      id: 'fixed_sidebar',
      name: { ru: 'Фиксированное меню', en: 'Fixed Sidebar' },
      category: 'appearance',
      default: false
    },
    collapseSearch: {
      id: 'collapse_search',
      name: { ru: 'Свернуть поиск', en: 'Collapse Search' },
      category: 'appearance',
      default: false
    },
    borderRadius: {
      id: 'border_radius',
      name: { ru: 'Радиус скругления', en: 'Border Radius' },
      category: 'appearance',
      default: 0, // 0 = по умолчанию
      type: 'range',
      min: 0,
      max: 24,
      step: 2
    },
    customBackground: {
      id: 'custom_background',
      name: { ru: 'Свой фон', en: 'Custom Background' },
      category: 'appearance',
      default: ''
    },
    backgroundBlur: {
      id: 'background_blur',
      name: { ru: 'Размытие фона', en: 'Background Blur' },
      category: 'appearance',
      default: 8,
      type: 'range',
      min: 0,
      max: 30,
      step: 1
    },
    backgroundDim: {
      id: 'background_dim',
      name: { ru: 'Затемнение фона', en: 'Background Dim' },
      category: 'appearance',
      default: 30,
      type: 'range',
      min: 0,
      max: 80,
      step: 5
    },
    backgroundOpacity: {
      id: 'background_opacity',
      name: { ru: 'Прозрачность фона', en: 'Background Opacity' },
      category: 'appearance',
      default: 100,
      type: 'range',
      min: 20,
      max: 100,
      step: 5
    }
  },

  // ==================
  // ФИЛЬТРЫ ИЗОБРАЖЕНИЙ
  // ==================
  filters: {
    grayscale: {
      id: 'filter_grayscale',
      name: { ru: 'Чёрно-белый режим', en: 'Grayscale' },
      category: 'filters',
      default: false
    },
    sepia: {
      id: 'filter_sepia',
      name: { ru: 'Сепия', en: 'Sepia' },
      category: 'filters',
      default: false
    },
    invert: {
      id: 'filter_invert',
      name: { ru: 'Инверсия цветов', en: 'Invert Colors' },
      category: 'filters',
      default: false
    },
    dimImages: {
      id: 'filter_dim_images',
      name: { ru: 'Затемнить изображения', en: 'Dim Images' },
      category: 'filters',
      default: false
    },
    blur: {
      id: 'filter_blur',
      name: { ru: 'Размытие', en: 'Blur' },
      category: 'filters',
      default: false
    },
    contrast: {
      id: 'filter_high_contrast',
      name: { ru: 'Высокий контраст', en: 'High Contrast' },
      category: 'filters',
      default: false
    },
    lowBrightness: {
      id: 'filter_low_brightness',
      name: { ru: 'Пониженная яркость', en: 'Low Brightness' },
      category: 'filters',
      default: false
    }
  },

  // ==================
  // СКРЫТИЕ ЭЛЕМЕНТОВ
  // ==================
  elements: {
    hideStories: {
      id: 'hide_stories',
      name: { ru: 'Истории', en: 'Stories' },
      category: 'elements',
      default: false
    },
    hideRecommendations: {
      id: 'hide_recommendations',
      name: { ru: 'Рекомендации', en: 'Recommendations' },
      category: 'elements',
      default: false
    },
    hideFriendsSuggestions: {
      id: 'hide_friends_suggestions',
      name: { ru: 'Возможные друзья', en: 'Friend Suggestions' },
      category: 'elements',
      default: false
    },
    hideEmojiStatus: {
      id: 'hide_emoji_status',
      name: { ru: 'Эмодзи-статусы', en: 'Emoji Status' },
      category: 'elements',
      default: false
    },
    hideMiniChat: {
      id: 'hide_mini_chat',
      name: { ru: 'Мини-чат', en: 'Mini Chat' },
      category: 'elements',
      default: false
    },
    hideScrollTop: {
      id: 'hide_scroll_top',
      name: { ru: 'Кнопка «Наверх»', en: 'Scroll to Top' },
      category: 'elements',
      default: false
    },
    hideMenuSettings: {
      id: 'hide_menu_settings',
      name: { ru: 'Настройки в меню', en: 'Menu Settings' },
      category: 'elements',
      default: false
    }
  },

  // ==================
  // ПРИВАТНОСТЬ
  // ==================
  privacy: {
    privacyMode: {
      id: 'privacy_mode',
      name: { ru: 'Режим невидимки', en: 'Privacy Mode' },
      category: 'privacy',
      default: false
    },
    hideOnlineStatus: {
      id: 'hide_online_status',
      name: { ru: 'Скрыть онлайн', en: 'Hide Online Status' },
      category: 'privacy',
      default: false
    },
    skeletonMode: {
      id: 'skeleton_mode',
      name: { ru: 'Режим скелетона', en: 'Skeleton Mode' },
      category: 'privacy',
      default: false,
      description: { ru: 'Скрыть аватары, имена и текст', en: 'Hide avatars, names and text' }
    }
  },

  // ==================
  // БЛОКИРОВКА РЕКЛАМЫ
  // ==================
  ads: {
    blockLeftAds: {
      id: 'block_left_ads',
      name: { ru: 'Боковая панель', en: 'Left Sidebar Ads' },
      category: 'ads',
      default: true
    },
    blockFeedAds: {
      id: 'block_feed_ads',
      name: { ru: 'Лента новостей', en: 'Feed Ads' },
      category: 'ads',
      default: true
    },
    blockStoriesAds: {
      id: 'block_stories_ads',
      name: { ru: 'Истории', en: 'Stories Ads' },
      category: 'ads',
      default: false
    },
    blockClipsAds: {
      id: 'block_clips_ads',
      name: { ru: 'Клипы', en: 'Clips Ads' },
      category: 'ads',
      default: false
    }
  }
};

// Категории
const CATEGORIES = {
  appearance: { ru: 'Внешний вид', en: 'Appearance' },
  filters: { ru: 'Фильтры', en: 'Filters' },
  elements: { ru: 'Элементы', en: 'Elements' },
  privacy: { ru: 'Приватность', en: 'Privacy' },
  ads: { ru: 'Реклама', en: 'Advertising' }
};

// Получить все функции в плоском виде
function getAllFeatures() {
  const features = [];
  for (const category in FEATURES) {
    for (const key in FEATURES[category]) {
      features.push(FEATURES[category][key]);
    }
  }
  return features;
}

// Получить функции по категории
function getFeaturesByCategory(category) {
  return Object.values(FEATURES[category] || {});
}

// Получить настройки по умолчанию
function getDefaultSettings() {
  const defaults = {};
  for (const category in FEATURES) {
    for (const key in FEATURES[category]) {
      const feature = FEATURES[category][key];
      defaults[feature.id] = feature.default;
    }
  }
  return defaults;
}