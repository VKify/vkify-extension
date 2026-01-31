class FeatureManager {
  constructor(storage) {
    this.storage = storage;
    this.activeFeatures = new Set();
    this.observers = new Map();
    this.styles = new Map();
  }

  async init() {
    const settings = await this.storage.getAll();
    
    // Применяем все активные настройки
    for (const [key, value] of Object.entries(settings)) {
      if (value === true || (typeof value === 'number' && value > 0) || (typeof value === 'string' && value !== '')) {
        await this.enable(key, value);
      }
    }

    // Слушаем изменения настроек
    this.storage.onChange((key, value) => {
      if (value === true || (typeof value === 'number' && value > 0) || (typeof value === 'string' && value !== '')) {
        this.enable(key, value);
      } else {
        this.disable(key);
      }
    });

    console.log('[VKify] Features initialized');
  }

  async enable(featureId, value = true) {
    const handler = this.getFeatureHandler(featureId);
    if (handler && handler.enable) {
      try {
        // Сначала отключаем если уже было включено (для обновления значений)
        if (this.activeFeatures.has(featureId) && handler.disable) {
          await handler.disable();
        }
        await handler.enable(value);
        this.activeFeatures.add(featureId);
        console.log(`[VKify] ✓ ${featureId}`, value);
      } catch (error) {
        console.error(`[VKify] ✗ ${featureId}:`, error);
      }
    }
  }

  async disable(featureId) {
    if (!this.activeFeatures.has(featureId)) {
      return;
    }

    const handler = this.getFeatureHandler(featureId);
    if (handler && handler.disable) {
      try {
        await handler.disable();
        this.activeFeatures.delete(featureId);
        console.log(`[VKify] ○ ${featureId}`);
      } catch (error) {
        console.error(`[VKify] ✗ disable ${featureId}:`, error);
      }
    }
  }

  getFeatureHandler(featureId) {
    const handlers = {
      // ==================
      // ВНЕШНИЙ ВИД
      // ==================
      
      // Расширенный режим
      style_widescreen: {
        enable: () => {
          // Константы для расчёта пропорций
          const GAP = 17;
          const BASE_LEFT = 550;
          const BASE_RIGHT = 345;
          const CONTENT_SUM = BASE_LEFT + BASE_RIGHT; // 895
          
          // Пропорции в процентах (от контейнера без gap)
          const LEFT_RATIO = BASE_LEFT / CONTENT_SUM;  // ≈ 0.6145
          const RIGHT_RATIO = BASE_RIGHT / CONTENT_SUM; // ≈ 0.3855
          
          this.injectCSS('style_widescreen', `
            /* Основные контейнеры */
            #page_header, 
            #page_layout { 
              width: 85% !important;
            }

            #footer_wrap { 
              width: 100% !important;
            }

            #page_body { 
              width: calc(100% - 170px) !important;
            }

            /* Чат */
            .im-chat-input .im-chat-input--textarea { 
              width: calc(100% - 120px) !important;
            }

            /* Загрузка */
            .page_module_upload { 
              padding: 28px 13px 28px 40% !important;
            }

            /* Приложения */
            .apps_recent_block { 
              width: calc(100% - 365px) !important;
            }

            .apps_featured_slider { 
              width: 100% !important;
            }

            /* Стена */
            .wall_text { 
              overflow: hidden;
            }

            /* ===== ПРОФИЛЬ: Двухколоночный layout ===== */
            
            /* Общий контейнер профиля */
            #profile_redesigned .vkuiSplitLayout__inner {
              box-sizing: border-box !important;
              width: 100% !important;
            }

            /* Левый блок (основной контент) */
            .Profile__column.vkuiSplitCol__host.vkuiSplitCol__viewWidthSmallTabletPlus.vkuiInternalSplitCol--viewWidth-tabletPlus.vkuiRootComponent__host {
              width: calc((100% - ${GAP}px) * ${LEFT_RATIO}) !important;
              min-width: 0 !important;
              max-width: none !important;
              flex-shrink: 0 !important;
              box-sizing: border-box !important;
            }

            /* ===== ПРАВЫЙ БЛОК ===== */
            
            /* ScrollStickyWrapper */
            #profile_redesigned .ScrollStickyWrapper {
              width: calc((100% - ${GAP}px) * ${RIGHT_RATIO}) !important;
              min-width: 0 !important;
              max-width: none !important;
              box-sizing: border-box !important;
            }
            
            /* Вложенный div - перебиваем инлайновые стили при скролле */
            #profile_redesigned .ScrollStickyWrapper > div {
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }
            
            /* Когда JS добавляет position: fixed при скролле */
            #profile_redesigned .ScrollStickyWrapper > div[style*="position: fixed"],
            #profile_redesigned .ScrollStickyWrapper > div[style*="position:fixed"] {
              width: inherit !important;
              max-width: calc((85vw - ${GAP}px) * ${RIGHT_RATIO}) !important;
            }

            /* aside внутри */
            #profile_redesigned .ScrollStickyWrapper > div > aside,
            #profile_redesigned .ScrollStickyWrapper aside {
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            /* Секции внутри aside */
            #profile_redesigned .ScrollStickyWrapper aside > section,
            #profile_redesigned .ScrollStickyWrapper aside .vkuiGroup__host {
              width: 100% !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            /* Контейнер SplitLayout */
            .vkuiSplitLayout__host.vkuiRootComponent__host {
              max-width: 100% !important;
            }
          `);
        },
        disable: () => this.removeCSS('style_widescreen')
      },

      // Ширина контента
      content_width: {
        enable: (value) => {
          if (!value || value === 0) return;
          
          // Константы для расчёта
          const GAP = 17;
          const BASE_LEFT = 550;
          const BASE_RIGHT = 345;
          const CONTENT_SUM = BASE_LEFT + BASE_RIGHT; // 895
          
          // Вычисляем ширину правого блока один раз
          const rightWidth = `calc((${value}px - ${GAP}px) * ${BASE_RIGHT} / ${CONTENT_SUM})`;
          
          this.injectCSS('content_width', `
            /* Основные контейнеры */
            #page_header, 
            #page_layout { 
              width: ${value}px !important;
            }

            #footer_wrap { 
              width: ${value}px !important;
            }

            #page_body { 
              width: calc(${value}px - 170px) !important;
            }

            /* Чат */
            .im-chat-input .im-chat-input--textarea { 
              width: calc(${value}px - 120px) !important;
            }

            /* Загрузка */
            .page_module_upload { 
              padding: 28px 13px 28px 40% !important;
            }

            /* Приложения */
            .apps_recent_block { 
              width: calc(${value}px - 365px) !important;
            }

            .apps_featured_slider { 
              width: ${value}px !important;
            }

            /* Стена */
            .wall_text { 
              overflow: hidden;
            }

            /* ===== ПРОФИЛЬ: Двухколоночный layout ===== */
            
            /* Общий контейнер профиля */
            #profile_redesigned .vkuiSplitLayout__inner {
              box-sizing: border-box !important;
              max-width: ${value}px !important;
            }

            /* Левый блок (основной контент) */
            .Profile__column.vkuiSplitCol__host.vkuiSplitCol__viewWidthSmallTabletPlus.vkuiInternalSplitCol--viewWidth-tabletPlus.vkuiRootComponent__host {
              width: calc((${value}px - ${GAP}px) * ${BASE_LEFT} / ${CONTENT_SUM}) !important;
              min-width: 0 !important;
              max-width: none !important;
              flex-shrink: 0 !important;
              box-sizing: border-box !important;
            }

            /* ===== ПРАВЫЙ БЛОК - ПЕРЕБИВАЕМ ВСЕ ИНЛАЙНОВЫЕ СТИЛИ ===== */
            
            /* ScrollStickyWrapper */
            #profile_redesigned .ScrollStickyWrapper {
              width: ${rightWidth} !important;
              min-width: 0 !important;
              max-width: none !important;
              box-sizing: border-box !important;
            }
            
            /* Вложенный div - ПЕРЕБИВАЕМ position: fixed и width */
            #profile_redesigned .ScrollStickyWrapper > div {
              width: 100% !important;
              min-width: 0 !important;
              max-width: ${rightWidth} !important;
              box-sizing: border-box !important;
            }
            
            /* Когда JS добавляет position: fixed при скролле */
            #profile_redesigned .ScrollStickyWrapper > div[style*="position: fixed"],
            #profile_redesigned .ScrollStickyWrapper > div[style*="position:fixed"] {
              width: ${rightWidth} !important;
              max-width: ${rightWidth} !important;
            }

            /* aside внутри */
            #profile_redesigned .ScrollStickyWrapper > div > aside,
            #profile_redesigned .ScrollStickyWrapper aside {
              width: 100% !important;
              min-width: 0 !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            /* Секции внутри aside */
            #profile_redesigned .ScrollStickyWrapper aside > section,
            #profile_redesigned .ScrollStickyWrapper aside .vkuiGroup__host {
              width: 100% !important;
              max-width: 100% !important;
              box-sizing: border-box !important;
            }

            /* Контейнер SplitLayout */
            .vkuiSplitLayout__host.vkuiRootComponent__host {
              max-width: ${value}px !important;
            }
          `);
        },
        disable: () => this.removeCSS('content_width')
      },
// Компактное меню (минималистичный сайдбар)
minimalistic_sidebar: {
  enable: () => {
    this.injectCSS('minimalistic_sidebar', `
      /* =================================================================
         1. СТРУКТУРА СТРАНИЦЫ (СЕТКА)
         ================================================================= */

      #page_header, #page_layout { width: 1156px !important; }
      #footer_wrap { width: 1156px !important; }
      #page_body { width: calc(1255px - 170px) !important; }
      
      .vkuiSplitCol__host {
        flex-grow: 100;
      }

  /* =================================================================
         2. ЛЕВАЯ ПАНЕЛЬ (SIDEBAR)
         ================================================================= */

      #side_bar,
      .side_bar {
        width: 65px !important;
        min-width: 65px !important;
        max-width: 65px !important;
        overflow: visible !important;
      }

      #side_bar_inner {
        width: 65px !important;
        overflow: visible !important;
      }

      .side_bar_nav_wrap,
      #react_rootLeftMenuRoot,
      #react_rootLeftMenuRoot > .vkui__root,
      [data-testid="leftmenu"] {
        width: 65px !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      [data-testid="leftmenu"] > ol,
      [data-testid="leftmenu"] ol[class*="LeftMenuOld__container"] {
        width: 100% !important;
        margin: 0 !important;
        padding: 12px 0 !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow: visible !important;
      }

      [data-testid="leftmenu"]::before {
        content: "МЕНЮ";
        display: block;
        font-size: 10px;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--vkui--color_text_secondary);
        font-weight: 700;
        margin-bottom: 8px;
        width: 100%;
        text-align: center;
        opacity: 0.7;
      }

      /* =================================================================
         3. ЭЛЕМЕНТЫ МЕНЮ
         ================================================================= */

      li[data-testid="leftmenuitem"],
      [class*="LeftMenuItem__container"] {
        width: 100% !important;
        height: 48px !important;
        margin-bottom: 2px;
        display: flex !important;
        justify-content: center;
        align-items: center;
        position: relative;
        overflow: visible !important;
      }

      li[data-testid="leftmenuitem"] > a,
      [class*="LeftMenuItem__item"] {
        width: 44px !important;
        height: 44px !important;
        min-width: 44px !important;
        padding: 0 !important;
        display: flex !important;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        overflow: visible !important;
        transition: background-color 0.2s ease;
        position: relative;
      }

      li[data-testid="leftmenuitem"] > a:hover,
      [class*="LeftMenuItem__item"]:hover {
        background-color: var(--vkui--color_background_hover);
      }

      [class*="LeftMenuItem__icon"] {
        margin: 0 !important;
        width: 24px !important;
        height: 24px !important;
        min-width: 24px !important;
      }

      [class*="LeftMenuItem__icon"] svg {
        width: 24px !important;
        height: 24px !important;
      }

      li[data-testid="leftmenuitem"] > a[aria-current="page"] [class*="LeftMenuItem__icon"],
      [class*="LeftMenuItem__item"][aria-current="page"] [class*="LeftMenuItem__icon"] {
        color: var(--vkui--color_icon_accent);
      }

      /* =================================================================
         4. ВСПЛЫВАЮЩИЕ ПОДСКАЗКИ
         ================================================================= */

      /* Внешний label - тултип */
      [data-testid="leftmenuitem-label"],
      [class*="LeftMenuItem__label"] {
        position: absolute !important;
        left: 60px !important;
        top: 50% !important;
        transform: translateY(-50%) translateX(-5px) !important;
        
        background: var(--vkui--color_background_modal, #fff) !important;
        color: var(--vkui--color_text_primary, #000) !important;
        border: 1px solid var(--vkui--color_separator_primary, #dce1e6) !important;
        padding: 6px 14px !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
        
        font-size: 13px !important;
        font-weight: 500 !important;
        line-height: 1.4 !important;
        white-space: nowrap !important;
        
        width: auto !important;
        height: auto !important;
        
        /* Flexbox для центрирования содержимого */
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        
        z-index: 2147483647 !important;
        transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s !important;
        overflow: visible !important;
      }

      /* Показ при ховере */
      li[data-testid="leftmenuitem"]:hover [data-testid="leftmenuitem-label"],
      li[data-testid="leftmenuitem"]:hover [class*="LeftMenuItem__label"],
      [class*="LeftMenuItem__container"]:hover [class*="LeftMenuItem__label"] {
        opacity: 1 !important;
        visibility: visible !important;
        transform: translateY(-50%) translateX(0) !important;
      }

      /* Стрелка */
      [data-testid="leftmenuitem-label"]::before,
      [class*="LeftMenuItem__label"]::before {
        content: "" !important;
        position: absolute !important;
        top: 50% !important;
        left: -6px !important;
        transform: translateY(-50%) !important;
        border-style: solid !important;
        border-width: 6px 6px 6px 0 !important;
        border-color: transparent var(--vkui--color_separator_primary, #dce1e6) transparent transparent !important;
      }

      [data-testid="leftmenuitem-label"]::after,
      [class*="LeftMenuItem__label"]::after {
        content: "" !important;
        position: absolute !important;
        top: 50% !important;
        left: -5px !important;
        transform: translateY(-50%) !important;
        border-style: solid !important;
        border-width: 5px 5px 5px 0 !important;
        border-color: transparent var(--vkui--color_background_modal, #fff) transparent transparent !important;
      }

      /* Внутренний labelIn - сброс стилей */
      [class*="LeftMenuItem__labelIn"] {
        position: static !important;
        display: flex !important;
        align-items: center !important;
        background: none !important;
        border: none !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        width: auto !important;
        height: auto !important;
        line-height: inherit !important;
      }

      /* Убираем псевдоэлементы с внутреннего */
      [class*="LeftMenuItem__labelIn"]::before,
      [class*="LeftMenuItem__labelIn"]::after {
        display: none !important;
        content: none !important;
      }

      /* Текст */
      [data-testid="leftmenuitem-text"],
      [class*="LeftMenuItem__labelIn"] [class*="TextClamp"] {
        display: flex !important;
        align-items: center !important;
        width: auto !important;
        max-width: none !important;
        height: auto !important;
        overflow: visible !important;
        text-overflow: clip !important;
        white-space: nowrap !important;
        -webkit-line-clamp: unset !important;
        line-clamp: unset !important;
        -webkit-box-orient: unset !important;
        line-height: inherit !important;
        transform: translateY(50%) translateX(0) !important;
      }

      /* =================================================================
         5. СЧЕТЧИКИ
         ================================================================= */

      [data-testid="leftmenuitem-counter"] {
        position: absolute !important;
        top: 2px !important;
        right: 2px !important;
        background-color: var(--vkui--color_accent_red) !important;
        color: #fff !important;
        border: 2px solid var(--vkui--color_background_content) !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        line-height: 12px !important;
        height: 16px !important;
        min-width: 16px !important;
        padding: 0 4px !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 50 !important;
        pointer-events: none !important;
      }

      li[data-testid="leftmenuitem"]:hover [data-testid="leftmenuitem-counter"] {
        transform: scale(1.1);
        transition: transform 0.2s ease;
      }

      /* =================================================================
         6. РАЗДЕЛИТЕЛИ
         ================================================================= */

      [class*="LeftMenuOld__separator"] {
        width: 32px !important;
        margin: 8px auto !important;
        opacity: 0.5;
      }

      /* =================================================================
         7. СКРЫТИЕ НЕНУЖНЫХ ЭЛЕМЕНТОВ
         ================================================================= */

      [data-testid="leftmenuitem-settings"],
      [class*="LeftMenuItem__settings"] {
        display: none !important;
      }

      #ads_wrapper,
      #ads_left,
      #ads_with_extra,
      .left_menu_nav_wrap,
      .LegalRecommendationsLinkLeftMenuAuthorized,
      [class*="WideSeparator--legalRecommendations"],
      [class*="Footer__root"],
      li[id="l_ads"] {
        display: none !important;
      }

      [class*="ImageBaseOverlayItem__root"] {
        display: none !important;
      }

      /* =================================================================
         8. LAYOUT SIDEBAR
         ================================================================= */

      #layout_sidebar:has([data-testid="leftmenu"]) {
        top: 14px !important;
        transform: translateX(-22px) !important;
      }

      #layout_sidebar {
        width: 65px !important;
        flex-basis: 65px !important;
        position: relative !important;
        z-index: 100 !important;
        overflow: visible !important;
      }

      #layout_sidebar:has([data-testid="leftmenu"]) [class*="LeftMenu__root"] {
        margin: 0 !important;
        padding: 0 !important;
        width: 65px !important;
        overflow: visible !important;
      }

      #layout_sidebar nav ol {
        width: 100% !important;
        margin: 0 !important;
        padding: 12px 0 !important;
        display: flex;
        flex-direction: column;
        align-items: center;
        overflow: visible !important;
      }

      #layout_sidebar li[data-testid="leftmenuitem"] .vkuiImageBase__host {
        margin: 0 !important;
        width: 28px !important;
        height: 28px !important;
        min-width: 28px !important;
        color: var(--vkui--color_icon_medium);
      }

      #layout_sidebar li[data-testid="leftmenuitem"] a[aria-current="page"] .vkuiImageBase__host {
        color: var(--vkui--color_icon_accent);
      }
    `);
  },
  disable: () => this.removeCSS('minimalistic_sidebar')
},

      // Фиксированное меню
      fixed_sidebar: {
        enable: () => {
          this.injectCSS('fixed_sidebar', `
            #side_bar:has([data-testid="leftmenu"]) {
                  position:sticky!important;
                  top:0px!important;
                }

                #layout_sidebar:has([data-testid="leftmenu"]) {
                position: sticky !important;
                top: 63px !important;
                transform: translateX(-22px) !important;
                }
          `);
        },
        disable: () => this.removeCSS('fixed_sidebar')
      },

      // Свернуть поиск
      collapse_search: {
        enable: () => {
          this.injectCSS('collapse_search', `
            /* =================================================================
              КОМПАКТНЫЙ ПОИСК (С ЭФФЕКТОМ РАЗДВИГАНИЯ)
              ================================================================= */

            /* 1. Родительский контейнер (#ts_wrap)
              Запрещаем ему растягиваться. Он должен быть ровно по ширине контента. */
            #ts_wrap {
                flex-grow: 0 !important;
                flex-shrink: 0 !important;
                width: auto !important; 
                min-width: 0 !important;
                padding: 0 8px !important; /* Небольшие отступы, как у обычной кнопки */
                margin: 0 !important;
                transition: all 0.3s ease-in-out;
            }

            /* 2. Поле поиска (Визуальный блок)
              В свернутом виде - ширина иконки (32px).
              Фон прозрачный, чтобы выглядело как иконка меню. */
            #ts_wrap .vkuiSearch__field {
                width: 32px !important; 
                background-color: transparent !important;
                padding: 0 !important;
                border-radius: 10px;
                cursor: pointer;
                box-shadow: none !important;
                transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s !important;
                position: relative;
                overflow: hidden; /* Чтобы текст не торчал сбоку */
            }

            /* 3. Иконка лупы (SVG)
              Фиксируем по центру свернутого блока */
            #ts_wrap .vkuiSearch__input svg {
                position: absolute !important;
                left: 8px !important; /* Центр блока 32px */
                top: 50% !important;
                transform: translateY(-50%) !important;
                z-index: 5;
                color: var(--vkui--color_header_text_secondary) !important; /* Цвет иконок шапки */
                transition: color 0.2s;
            }

            /* 4. Текстовое поле (Input)
              Скрываем его полностью в свернутом режиме */
            #ts_wrap .vkuiSearch__nativeInput {
                opacity: 0 !important;
                padding-left: 36px !important; /* Место под лупу */
                padding-right: 0 !important;
                width: 100% !important;
                pointer-events: none; /* Чтобы не мешал кликать на лупу */
                transition: opacity 0.2s ease !important;
            }

            /* 5. Убираем лишний лейбл "Поиск", который создает отступы */
            #ts_wrap .vkuiSearch__label {
                display: none !important;
            }

            /* -----------------------------------------------------------------
              АКТИВНОЕ СОСТОЯНИЕ (HOVER / FOCUS)
              ----------------------------------------------------------------- */

            /* Раздвигаем поле */
            #ts_wrap .vkuiSearch__field:hover,
            #ts_wrap .vkuiSearch__field:focus-within {
                width: 230px !important; /* Целевая ширина */
                background-color: var(--vkui--color_field_background) !important;
                cursor: text;
            }

            /* Показываем текст и включаем ввод */
            #ts_wrap .vkuiSearch__field:hover .vkuiSearch__nativeInput,
            #ts_wrap .vkuiSearch__field:focus-within .vkuiSearch__nativeInput {
                opacity: 1 !important;
                pointer-events: auto;
            }

            /* Меняем цвет иконки на активный (серый потемнее) */
            #ts_wrap .vkuiSearch__field:hover svg,
            #ts_wrap .vkuiSearch__field:focus-within svg {
                color: var(--vkui--color_icon_medium) !important;
            }

            /* Крестик очистки (появляется только при вводе) */
            #ts_wrap .vkuiSearch__controls {
                opacity: 0;
                transition: opacity 0.2s;
            }
            #ts_wrap .vkuiSearch__field:focus-within .vkuiSearch__controls {
                opacity: 1;
            }
          `);
        },
        disable: () => this.removeCSS('collapse_search')
      },

      // Радиус скругления
      border_radius: {
        enable: (value) => {
          if (!value || value === 0) return;
          
          // Ограничения для разных типов элементов
          const cardRadius = value;
          const avatarRadius = Math.min(value, 50);
          const buttonRadius = Math.min(value, 12);
          const inputRadius = Math.min(value, 12);
          const imageRadius = Math.min(value, 16);
          const smallRadius = Math.min(value, 8);
          const tabRadius = Math.min(value, 10);
          
          this.injectCSS('border_radius', `
            /* ===== КАРТОЧКИ И БЛОКИ ===== */
            .ProfileHeader,
            .page_block,
            .Post,
            .post,
            ._post,
            .wall_item,
            .feed_row,
            .box_body,
            .group_row,
            .friends_row,
            
            /* VK UI Cards & Groups */
            .vkuiCard,
            .vkuiGroup__host,
            .vkuiModalPage__in,
            .vkuiModalCard,
            .vkuiPopout,
            .vkuiActionSheet,
            .vkuiAlert,
            
            /* Общие паттерны */
            [class*="Card"]:not([class*="vkuiModalCard"]),
            [class*="Modal"]:not([class*="vkuiModal"]),
            [class*="Popup"] {
              border-radius: ${cardRadius}px !important;
            }
            
            /* ===== АВАТАРЫ ===== */
            .page_avatar img,
            .post_image img,
            .reply_image img,
            .friend_photo img,
            
            /* VK UI Avatars */
            .vkuiAvatar__host,
            .vkuiAvatar__host img,
            .vkuiImageBase__host,
            .vkuiImageBase__img,
            
            /* UsersStack - стек аватаров */
            .vkuiUsersStack__photo,
            .vkuiUsersStack__photo circle,
            .vkuiUsersStack__photos .vkuiUsersStack__item {
              border-radius: ${avatarRadius}% !important;
            }
            
            /* SVG в UsersStack */
            .vkuiUsersStack__photo image {
              clip-path: inset(0 round ${avatarRadius}%) !important;
            }
            
            /* ===== МЕССЕНДЖЕР - АВАТАРЫ ===== */
            
            /* MEAvatar - основной класс аватаров в сообщениях */
            .MEAvatar,
            .MEAvatar__imgWrapper,
            .MEAvatar__imgWrapper img {
              border-radius: ${avatarRadius}% !important;
              clip-path: none !important;
            }
            
            /* BasicAvatar - базовый аватар */
            .BasicAvatar,
            .BasicAvatar img {
              border-radius: ${avatarRadius}% !important;
            }
            
            /* ReImage - контейнер изображения */
            .OwnerPageAvatar__underlay,
            .ReImage,
            .ReImage__img {
              border-radius: ${avatarRadius}% !important;
            }
            
            /* Скрываем SVG-маску для аватаров */
            .MEAvatar__svg {
              display: none !important;
            }
            
            /* ConvoListItem - элемент списка диалогов */
            .ConvoListItem__avatar .MEAvatar,
            .ConvoListItem__avatar .MEAvatar__imgWrapper,
            .ConvoListItem__avatar .BasicAvatar,
            .ConvoListItem__avatar img {
              border-radius: ${avatarRadius}% !important;
              clip-path: none !important;
            }
            
            /* ===== КНОПКИ ===== */
            .flat_button,
            .button,
            
            /* VK UI Buttons */
            .vkuiButton__host,
            .vkuiButton,
            .vkuiIconButton__host,
            
            /* ButtonGroup */
            .vkuiButtonGroup__host .vkuiButton__host:first-child {
              border-top-left-radius: ${buttonRadius}px !important;
              border-bottom-left-radius: ${buttonRadius}px !important;
            }
            
            .vkuiButtonGroup__host .vkuiButton__host:last-child {
              border-top-right-radius: ${buttonRadius}px !important;
              border-bottom-right-radius: ${buttonRadius}px !important;
            }
            
            .vkuiButtonGroup__host .vkuiButton__host:only-child {
              border-radius: ${buttonRadius}px !important;
            }
            
            .vkuiButton__host:not(.vkuiButtonGroup__host .vkuiButton__host) {
              border-radius: ${buttonRadius}px !important;
            }
            
            /* ===== ТАБЫ ===== */
            .vkuiTabs__host,
            .vkuiTabs__in {
              border-radius: ${tabRadius}px !important;
            }
            
            .vkuiTabsItem__host {
              border-radius: ${tabRadius}px !important;
            }
            
            [role="tab"].vkuiTabsItem__host {
              border-radius: ${tabRadius}px !important;
            }
            
            /* ===== ИНПУТЫ ===== */
            input[type="text"],
            input[type="search"],
            input[type="password"],
            input[type="email"],
            textarea,
            
            /* VK UI Inputs */
            .vkuiInput__host,
            .vkuiInput__el,
            .vkuiTextarea__host,
            .vkuiSearch__host,
            .vkuiSearch__input,
            .vkuiFormField__host {
              border-radius: ${inputRadius}px !important;
            }
            
            /* ===== ИЗОБРАЖЕНИЯ В ПОСТАХ ===== */
            .page_post_thumb_wrap img,
            .media_link__photo img,
            .PhotoPrimaryAttachment img,
            .PhotoPrimaryAttachment,
            
            /* VK UI Images */
            .vkuiImage__host {
              border-radius: ${imageRadius}px !important;
            }
            
            /* ===== МЕЛКИЕ ЭЛЕМЕНТЫ ===== */
            .vkuiCounter__host,
            .vkuiBadge__host,
            .vkuiSimpleCell__host,
            .UnreadCounter,
            .vkuiHorizontalCell__host {
              border-radius: ${smallRadius}px !important;
            }
            
            .vkuiScrollArrow__host {
              border-radius: ${smallRadius}px !important;
            }
            
            .vkuiHorizontalScroll__host {
              border-radius: ${cardRadius}px !important;
            }
            
            /* ===== TAPPABLE ЭФФЕКТЫ ===== */
            .vkuiTappable__ripple,
            .vkuiTappable__stateLayer {
              border-radius: inherit !important;
            }
            
            /* ===== CSS ПЕРЕМЕННЫЕ VK UI ===== */
            :root {
              --vkui_internal--Image_border_radius: ${imageRadius}px !important;
            }
            
            .vkuiImageBase__host {
              --vkui_internal--Image_border_radius: ${imageRadius}px !important;
            }
          `);
        },
        disable: () => this.removeCSS('border_radius')
      },

      // Свой фон
      custom_background: {
        enable: async (url) => {
          if (!url) return;
          
          // Получаем настройки из storage
          const settings = await this.storage.getAll();
          const blur = settings.background_blur ?? 8;
          const dim = settings.background_dim ?? 30;
          const opacity = settings.background_opacity ?? 100;
          
          this.injectCSS('custom_background', `
          .ProfileWrapper__root {
            background: transparent !important;
          }
          
          :root, .scroll_fix, #layout_wrapper_root {
            background: transparent !important;
            position: relative;
          }
          
          /* Размытый фон через псевдоэлемент */
          body::before {
            content: "";
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: -1;
            background-image: 
              linear-gradient(rgba(0, 0, 0, ${dim / 100}), rgba(0, 0, 0, ${dim / 100})),
              url("${url}");
            background-size: cover;
            background-position: center;
            background-attachment: fixed;
            filter: blur(${blur}px);
            -webkit-filter: blur(${blur}px);
            opacity: ${opacity / 100};
            transform: scale(1.05);
          }
          
          #side_bar_inner, .side_bar_inner {
            box-shadow: var(--page-block-shadow) !important;
            margin-top: calc(var(--header-height) + 16px) !important;
            position: relative !important;
            background: var(--vkui--color_background_content) !important;
            border-radius: var(--vkui--size_border_radius_paper--regular) !important;
            padding: 4px !important;
            transform: translateX(-22px) !important;
          }
          
          #layout_sidebar:has([data-testid="leftmenu"]) {
            box-shadow: var(--page-block-shadow) !important;
            top: 16px !important;
            position: relative !important;
            background: var(--vkui--color_background_content) !important;
            border-radius: var(--vkui--size_border_radius_paper--regular) !important;
            padding: 4px !important;
            transform: translateX(-22px) !important;
          }
          
          [class^="LeftMenuItem-module__item"], [class*="LeftMenuItem__item"] {
            border-radius: 10px !important;
          }
          
          .side_bar_nav_wrap, #layout_sidebar:has([data-testid="leftmenu"]) [class*="LeftMenu__root"] {
            margin: 0px !important;
            padding: 0px !important;
          }
          `);
        },
        disable: () => this.removeCSS('custom_background')
      },

      // Эти обработчики просто переприменяют фон с новыми значениями
      background_blur: {
        enable: async () => {
          const url = await this.storage.get('custom_background');
          if (url) this.getFeatureHandler('custom_background').enable(url);
        },
        disable: async () => {
          const url = await this.storage.get('custom_background');
          if (url) this.getFeatureHandler('custom_background').enable(url);
        }
      },

      background_dim: {
        enable: async () => {
          const url = await this.storage.get('custom_background');
          if (url) this.getFeatureHandler('custom_background').enable(url);
        },
        disable: async () => {
          const url = await this.storage.get('custom_background');
          if (url) this.getFeatureHandler('custom_background').enable(url);
        }
      },

      background_opacity: {
        enable: async () => {
          const url = await this.storage.get('custom_background');
          if (url) this.getFeatureHandler('custom_background').enable(url);
        },
        disable: async () => {
          const url = await this.storage.get('custom_background');
          if (url) this.getFeatureHandler('custom_background').enable(url);
        }
      },

    // Акцентный цвет / Своя тема
    custom_accent: {
      enable: (color) => {
        if (!color) return;
        
        const hexToRgb = (hex) => {
          const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          } : null;
        };
        
        const rgb = hexToRgb(color);
        const rgbString = rgb ? `${rgb.r}, ${rgb.g}, ${rgb.b}` : '0, 119, 255';
        
        this.injectCSS('custom_accent', `
          :root,
          .vkui--vkBase--light,
          .vkui--vkBase--dark,
          .vkui--vkCom--light,
          .vkui--vkCom--dark,
          [scheme="vkcom_light"],
          [scheme="vkcom_dark"],
          [scheme="bright_light"],
          [scheme="space_gray"],
          [data-scheme="vkcom_light"],
          [data-scheme="vkcom_dark"],
          body {
            --accent: ${color} !important;
            --accent-rgb: ${rgbString} !important;
            
            --vkui--color_text_link: var(--accent) !important;
            --vkui--color_text_link--hover: var(--accent) !important;
            --vkui--color_text_link--active: var(--accent) !important;
            --vkui--color_text_link_themed: var(--accent) !important;
            --vkui--color_text_accent: var(--accent) !important;
            --vkui--color_text_accent_themed: var(--accent) !important;
            --text_link: var(--accent) !important;
            --text_name: var(--accent) !important;
            --im_text_name: var(--accent) !important;
            --link_alternate: var(--accent) !important;
            
            --vkui--color_icon_accent: var(--accent) !important;
            --vkui--color_icon_accent_themed: var(--accent) !important;
            --tabbar_active_icon: var(--accent) !important;
            --tabbar_tablet_active_icon: var(--accent) !important;
            --header_tint: var(--accent) !important;
            --header_tint_alternate: var(--accent) !important;
            --im_attach_tint: var(--accent) !important;
            --writebar_icon: var(--accent) !important;
            
            --vkui--color_background_accent: var(--accent) !important;
            --vkui--color_background_accent--hover: var(--accent) !important;
            --vkui--color_background_accent--active: var(--accent) !important;
            --vkui--color_background_accent_themed: var(--accent) !important;
            --vkui--color_background_accent_themed--hover: var(--accent) !important;
            --vkui--color_background_accent_themed--active: var(--accent) !important;
            --vkui--color_background_accent_alternative: var(--accent) !important;
            --button-background-color: var(--accent) !important;
            --landing_login_button_background: var(--accent) !important;
            --landing_primary_button_background: var(--accent) !important;
            
            --counter_primary_background: var(--accent) !important;
            --header_tab_active_indicator: var(--accent) !important;
            --header_alternate_tab_active_indicator: var(--accent) !important;
            --loader_track_value_fill: var(--accent) !important;
            
            --im_reply_sender_text: var(--accent) !important;
            --im_reply_separator: var(--accent) !important;
            
            --action_sheet_action_foreground: var(--accent) !important;
            --attach_picker_tab_active_background: var(--accent) !important;
            --attach_picker_tab_active_text: var(--accent) !important;
            --cell_button_foreground: var(--accent) !important;
            --control_foreground: var(--accent) !important;
            --landing_tertiary_button_foreground: var(--accent) !important;
            --landing_secondary_button_foreground: var(--accent) !important;
            --landing_text_title: var(--accent) !important;
            --feed_recommended_friend_promo_background: var(--accent) !important;
            --dynamic_blue: var(--accent) !important;
            
            --blue_400: var(--accent) !important;
            --blue_a400: var(--accent) !important;
            --blue_420: var(--accent) !important;
            --blue_550: var(--accent) !important;
            --blue_600: var(--accent) !important;
            --blue_640: var(--accent) !important;
            --blue_800: var(--accent) !important;
            --blue_bright: var(--accent) !important;
            --sky_100: var(--accent) !important;
            --sky_200: var(--accent) !important;
            --light_blue_700: var(--accent) !important;
            
            --blue_400_alpha20: rgba(var(--accent-rgb), 0.2) !important;
            --blue_400_alpha48: rgba(var(--accent-rgb), 0.48) !important;
            --vkui--color_background_accent_tint: rgba(var(--accent-rgb), 0.12) !important;
            --vkui--color_background_accent_tint--hover: rgba(var(--accent-rgb), 0.16) !important;
            --vkui--color_background_accent_tint--active: rgba(var(--accent-rgb), 0.2) !important;
            --text_link_hightlighted_background: rgba(var(--accent-rgb), 0.12) !important;
          }
          
          /* Логотип через data-атрибут */
          [data-vkify-logo-bg="true"] {
            fill: ${color} !important;
          }
          
          .FlatButton--primary,
          .Button--primary,
          [class*="Button--mode-primary"],
          .vkuiButton--mode-primary {
            background-color: var(--accent) !important;
          }
          
          .Checkbox--checked .Checkbox__icon,
          .Radio--checked .Radio__icon,
          [class*="Checkbox"][class*="checked"],
          [class*="Radio"][class*="checked"] {
            background-color: var(--accent) !important;
            border-color: var(--accent) !important;
          }
          
          .Switch--checked,
          [class*="Switch"][class*="checked"] {
            background-color: var(--accent) !important;
          }
          
          .Progress__in,
          [class*="Progress__in"],
          .vkuiProgress__in {
            background-color: var(--accent) !important;
          }
          
          .TabsItem--selected,
          [class*="TabsItem--selected"],
          .vkuiTabsItem--selected {
            color: var(--accent) !important;
          }
          
          .TabsItem--selected::after,
          [class*="TabsItem--selected"]::after {
            background-color: var(--accent) !important;
          }
          
          ::selection {
            background-color: rgba(var(--accent-rgb), 0.3) !important;
          }
        `);
        
        // Применяем цвет к логотипу
        this.updateLogoColor(color);
      },
      disable: () => {
        this.removeCSS('custom_accent');
        this.resetLogoColor();
      }
    },

      // ==================
      // ФИЛЬТРЫ
      // ==================

      // Чёрно-белый режим
      filter_grayscale: {
        enable: () => {
          this.injectCSS('filter_grayscale', `
            html {
              filter: grayscale(1) !important;
            }
          `);
        },
        disable: () => this.removeCSS('filter_grayscale')
      },

      // Сепия
      filter_sepia: {
        enable: () => {
          this.injectCSS('filter_sepia', `
            html {
              filter: sepia(0.8) !important;
            }
          `);
        },
        disable: () => this.removeCSS('filter_sepia')
      },

      // Инверсия цветов
      filter_invert: {
        enable: () => {
          this.injectCSS('filter_invert', `
            html {
              filter: invert(1) hue-rotate(180deg) !important;
            }
            /* Исключаем изображения из инверсии */
            img, video, iframe, canvas, svg {
              filter: invert(1) hue-rotate(180deg) !important;
            }
          `);
        },
        disable: () => this.removeCSS('filter_invert')
      },

      // Затемнение изображений
      filter_dim_images: {
        enable: () => {
          this.injectCSS('filter_dim_images', `
            img,
            video,
            .page_post_thumb_wrap,
            .MediaGrid__thumb,
            [class*="PhotoPrimaryAttachment"],
            [class*="VideoThumb"],
            .photo_row img,
            .media_link__photo {
              filter: brightness(0.6) !important;
              transition: filter 0.2s ease !important;
            }
            
            img:hover,
            video:hover,
            .page_post_thumb_wrap:hover img,
            .MediaGrid__thumb:hover img {
              filter: brightness(1) !important;
            }
          `);
        },
        disable: () => this.removeCSS('filter_dim_images')
      },

      // Размытие
      filter_blur: {
        enable: () => {
          this.injectCSS('filter_blur', `
            html {
              filter: blur(10px) !important;
            }
            html:hover {
              filter: blur(0) !important;
            }
          `);
        },
        disable: () => this.removeCSS('filter_blur')
      },

      // Высокий контраст
      filter_high_contrast: {
        enable: () => {
          this.injectCSS('filter_high_contrast', `
            html {
              filter: contrast(1.3) !important;
            }
          `);
        },
        disable: () => this.removeCSS('filter_high_contrast')
      },

      // Пониженная яркость
      filter_low_brightness: {
        enable: () => {
          this.injectCSS('filter_low_brightness', `
            html {
              -webkit-filter: brightness(0.8) !important;
              filter: brightness(0.8) !important;
            }
          `);
        },
        disable: () => this.removeCSS('filter_low_brightness')
      },

      // ==================
      // СКРЫТИЕ ЭЛЕМЕНТОВ
      // ==================

      // Истории
      hide_stories: {
        enable: () => {
          this.injectCSS('hide_stories', `
            [class*="StoriesSection"],
            [class*="stories_feed"],
            [class*="StoryBlock"],
            .stories_feed_wrap,
            ._stories_wrap {
              display: none !important;
            }
          `);
        },
        disable: () => this.removeCSS('hide_stories')
      },

      // Рекомендации
      hide_recommendations: {
        enable: () => {
          this.injectCSS('hide_recommendations', `
            [class*="RecommendedGroups"],
            [class*="RecommendedContent"],
            [class*="feed_recom"],
            [class*="FeedRecommendation"],
            .feed_groups_recomm,
            .feed_friends_recomm,
            ._feed_recommendations,
            [class*="PageBlock"][class*="recommend"],
            .groups_recomm,
            .public_recomm {
              display: none !important;
            }
          `);
        },
        disable: () => this.removeCSS('hide_recommendations')
      },

      // Возможные друзья
      hide_friends_suggestions: {
        enable: () => {
          this.injectCSS('hide_friends_suggestions', `
            section.vkuiGroup__host:has([title="Возможные друзья"]),
            section.vkuiGroup__host:has([title="People you may know"]),
            section.vkuiGroup__host:has([title="Ймовірні друзі"]),
            [class*="FriendsSuggestions"],
            [class*="friends_suggests"],
            .friends_possible,
            ._friends_suggestions {
              display: none !important;
            }
          `);
        },
        disable: () => this.removeCSS('hide_friends_suggestions')
      },

      // Эмодзи-статусы
      hide_emoji_status: {
        enable: () => {
          this.injectCSS('hide_emoji_status', `
            [class*="UserNameIcon__icon"]:not(:has(.vkuiIcon--verified_16)) ,[class*="OwnerNameIcon__icon"]:not(.OwnerPageName__esia, .OwnerPageName__prometheus, .OwnerPageName__verified),[class*="OwnerNameIcon-module__icon"]:not(.OwnerPageName__esia, .OwnerPageName__prometheus, .OwnerPageName__verified), .image_status__status, .PostHeaderTitle__imageStatus,span[class^="UserNameIcon-module__icon"]:has(>img),div[class^="StatusIcon"]:has(>img) { display: none !important; }
          `);
        },
        disable: () => this.removeCSS('hide_emoji_status')
      },

      // Мини-чат
      hide_mini_chat: {
        enable: () => {
          this.injectCSS('hide_mini_chat', `
            #fc_container,
            #fastchat-reforged,
            .fc_container,
            [class*="MiniChat"],
            [class*="FastChat"] {
              display: none !important;
            }
          `);
        },
        disable: () => this.removeCSS('hide_mini_chat')
      },

      // Кнопка наверх
      hide_scroll_top: {
        enable: () => {
          this.injectCSS('hide_scroll_top', `
            #stl_left,
            .stl_left,
            .TopButton,
            [class*="ScrollToTop"],
            [class*="scroll_to_top"] {
              display: none !important;
            }
          `);
        },
        disable: () => this.removeCSS('hide_scroll_top')
      },

      // Настройки в меню
      hide_menu_settings: {
        enable: () => {
          this.injectCSS('hide_menu_settings', `
            [class*="LeftMenuItem"][class*="settings"],
            [class*="vkitLeftMenuItem__settings"],
            .left_menu_nav [href*="/settings"],
            #l_set {
              display: none !important;
            }
          `);
        },
        disable: () => this.removeCSS('hide_menu_settings')
      },

      // ==================
      // ПРИВАТНОСТЬ
      // ==================

      // Режим невидимки (Ctrl+Q)
      privacy_mode: {
        enable: () => this.enablePrivacyMode(),
        disable: () => this.disablePrivacyMode()
      },

      // Режим скелетона (скрыть аватары, имена, текст)
      skeleton_mode: {
        enable: () => {
          this.injectCSS('skeleton_mode', `
            /* =================================================================
              SKELETON MODE - Режим заглушек
              ================================================================= */

            /* ===== АВАТАРЫ - СКРЫТИЕ ИЗОБРАЖЕНИЙ ===== */
            
            .page_avatar img,
            .post_image img,
            .reply_image img,
            .friend_photo img,
            .im_peer_photo img,
            .online_camera_image,
            .vkuiAvatar__host img,
            .vkuiAvatar__host .vkuiImageBase__img,
            .vkuiImageBase__host img,
            .MEAvatar img,
            .MEAvatar__imgWrapper img,
            .BasicAvatar img,
            .ReImage__img,
            .vkuiUsersStack__photo image,
            .vkuiHorizontalCell__image img,
            .vkuiSimpleCell__before img,
            .vkuiRichCell__before img {
              visibility: hidden !important;
              opacity: 0 !important;
            }
            
            /* ===== АВАТАРЫ - ЗАГЛУШКА ===== */
            
            .page_avatar,
            .post_image,
            .reply_image,
            .friend_photo,
            .im_peer_photo,
            .vkuiAvatar__host,
            .vkuiImageBase__host,
            .MEAvatar,
            .MEAvatar__imgWrapper,
            .BasicAvatar,
            .ReImage,
            .vkuiUsersStack__photo,
            .vkuiUsersStack__photoWrapper,
            .vkuiHorizontalCell__image .vkuiAvatar__host,
            .vkuiSimpleCell__before .vkuiAvatar__host,
            .vkuiRichCell__before .vkuiAvatar__host {
              background: var(--vkui--color_background_secondary) !important;
            }
            
            /* Скрываем SVG маски */
            .MEAvatar__svg,
            .vkuiUsersStack__fill {
              opacity: 0 !important;
            }

            /* ===== ИМЕНА ПРОФИЛЕЙ И СТРАНИЦ ===== */
            
            .OwnerPageName,
            .OwnerPageName__icons,
            .OwnerPageName .vkuiEllipsisText__content,
            .CommunityHead__groupName--4rPhH,
            .CommunityHead__groupName--4rPhH span {
              color: transparent !important;
              background: var(--vkui--color_background_secondary) !important;
              border-radius: 4px !important;
            }

            /* ===== ИМЕНА И ЗАГОЛОВКИ ===== */
            
            .author,
            .author_name,
            .wall_signed,
            .PostHeaderTitle,
            .PostHeaderTitle__link,
            .PostHeaderSubtitle__name,
            .im_peer_title,
            .top_nav_link,
            .vkuiTitle__host,
            .vkuiSimpleCell__children,
            .vkuiHeader__content,
            .ConvoTitle__author,
            .ConvoTitle__title,
            a[href*="/id"] > span,
            a[href*="/club"] > span,
            a[href*="/public"] > span,
            .vkuiEllipsisText__content,
            .vkuiRichCell__children,
            .vkitUserRichCell__name--Ro88R,
            .vkitUserRichCell__name--Ro88R a,
            .vkitTextClamp__root--ewZ0L {
              color: transparent !important;
              background: var(--vkui--color_background_secondary) !important;
              border-radius: 4px !important;
            }

            /* ===== ТЕКСТ ПОСТОВ И СООБЩЕНИЙ ===== */
            
            .wall_post_text,
            .reply_text,
            .post_text,
            .message_text,
            .im_msg_text,
            .vkuiText__host,
            .vkuiParagraph__host,
            .ConvoListItem__text,
            .ConvoListItem__message,
            .MessagePreview {
              color: transparent !important;
              background: var(--vkui--color_background_secondary) !important;
              border-radius: 4px !important;
            }

            /* ===== ПОДЗАГОЛОВКИ И СУБТИТЛЫ ===== */
            
            .vkuiRichCell__subtitle,
            .vkuiRichCell__extraSubtitle,
            .vkuiSimpleCell__subtitle,
            .vkuiCaption__host,
            .vkuiFootnote__host,
            .vkuiSubhead__host,
            .vkitAudioArtists__artist--J2cnS,
            .vkitAudioArtists__artist--J2cnS span {
              color: transparent !important;
              background: var(--vkui--color_background_secondary) !important;
              border-radius: 4px !important;
            }

            /* ===== ССЫЛКИ ===== */
            
            .vkuiLink__host,
            .vkitLink__link--b0dQw,
            .vkitActionsGroupItem__root--ZZBhC,
            .vkitActionsGroupItem__root--ZZBhC a,
            .vkitActionsGroupItem__root--ZZBhC span {
              color: transparent !important;
              background: var(--vkui--color_background_secondary) !important;
              border-radius: 4px !important;
            }

            /* ===== ИКОНКИ ===== */
            
            .vkuiIcon,
            .OwnerNameIcon__icon--yuKQh img,
            .UserNameIcon__icon--BV841 img {
              opacity: 0.8 !important;
            }

            /* ===== СЧЁТЧИКИ И БЕЙДЖИ ===== */
            
            .vkuiCounter__host,
            .vkuiBadge__host,
            .vkuiHeader__indicator,
            [data-testid="leftmenuitem-counter"],
            .UnreadCounter {
              background: var(--vkui--color_background_secondary) !important;
              color: transparent !important;
            }

            /* ===== КНОПКИ ===== */
            
            .vkuiButton__content,
            .vkuiButton__in {
              color: transparent !important;
              background: var(--vkui--color_background_secondary) !important;
              border-radius: 4px !important;
            }

            /* ===== ДАТА/ВРЕМЯ ===== */
            
            .ConvoListItem__date,
            .post_date,
            .reply_date,
            .PostHeaderSubtitle__item {
              color: transparent !important;
              background: var(--vkui--color_background_secondary) !important;
              border-radius: 4px !important;
            }
            
            /* ===== ТАБЫ ===== */
            
            .vkuiTabsItem__label {
              color: transparent !important;
              background: var(--vkui--color_background_secondary) !important;
              border-radius: 4px !important;
            }

            /* ===== ДЕЙСТВИЯ И ГРУППЫ ДЕЙСТВИЙ ===== */
            
            .vkuiRichCell__actions,
            .vkitActionsGroup__root--fO6Zv,
            .vkitUserRichCellActionsGroup__container--qexSV {
              opacity: 0.5 !important;
            }

            /* ===== EMOJI ===== */
            
            .Emoji {
              opacity: 0.3 !important;
            }
          `);
        },
        disable: () => this.removeCSS('skeleton_mode')
      },

      // ==================
      // РЕКЛАМА
      // ==================

      block_left_ads: {
        enable: () => {
          this.injectCSS('block_left_ads', `
            #ads_wrapper{
              display: none !important;
            }
          `);
        },
        disable: () => this.removeCSS('block_left_ads')
      },

      block_feed_ads: {
        enable: () => {
          this.injectCSS('block_feed_ads', `
            /* Главный селектор - посты с кнопкой подписки */
            [data-testid="post"]:has([data-testid="post-header-subscription-button"]),
            [data-post-id]:has([data-testid="post-header-subscription-button"]),
            article:has([data-testid="post-header-subscription-button"]),
            
            /* Рекламный блок приложений справа */
            .apps_feedRightAppsBlock,
            .apps_feedRightAppsBlock_single_app,
            [data-testid="feed_apps_right_block"],
            [data-block-type="featured_promo_game"] {
            display: none !important;
            }

            /* Скрыть блок видео-рекомендаций */
            [data-testid="videos_for_you_block_spa"],
            article:has([data-testid="videos_for_you_block_spa"]) {
              display: none !important;
            } 
          `);
        },
        disable: () => this.removeCSS('block_feed_ads')
      },

      block_stories_ads: {
        enable: () => {
          this.injectCSS('block_stories_ads', `
            /* Блок "Интересное" (Discover Stories) */
            [data-testid="story_card_discover"],
            [data-type="story_card_discover"],
            .vkitStoryCard__rootDiscover--j6R3c,
            [data-testid="grid-item"]:has([data-testid="story_card_discover"]) {
              display: none !important;
            }
          `);
        },
        disable: () => this.removeCSS('block_stories_ads')
      },
      
      block_clips_ads: {
        enable: () => {
          this.injectCSS('block_clips_ads', `

          `);
        },
        disable: () => this.removeCSS('block_clips_ads')
      },

      // ==================
      // СКРИПТЫ
      // ==================
      
      // Обход окна авторизации
      bypass_auth_popup: {
        enable: () => {
          // CSS для скрытия элементов
          this.injectCSS('bypass_auth_popup', `
            .vkc__AuthRoot__authLayer,
            #box_layer_bg,
            #box_layer_wrap,
            .box_layer,
            .popup_box_container,
            #PageBottomBanner,
            .PageBottomBanner,
            #page_bottom_banner,
            .page_bottom_banner,
            .UnauthActionBlock,
            .TopUnauthPanel,
            .vkc__AuthFooter,
            .vkc__BottomAuthPanel,
            .vkc__AuthRoot__root,
            [class*="UnauthBanner"],
            [class*="AuthRoot"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
            
            body, html {
              overflow: auto !important;
            }
            
            body.noscroll,
            body.scroll_fix,
            html.noscroll,
            html.scroll_fix {
              overflow: auto !important;
              position: static !important;
            }
          `);
          
          // JS для удаления элементов и восстановления скролла
          const fixVK = () => {
            // Удаляем элементы
            const selectors = [
              '.vkc__AuthRoot__authLayer',
              '#box_layer_bg',
              '#box_layer_wrap',
              '.box_layer',
              '.popup_box_container',
              '#PageBottomBanner',
              '.PageBottomBanner',
              '#page_bottom_banner',
              '.page_bottom_banner',
              '.UnauthActionBlock',
              '.TopUnauthPanel',
              '.vkc__AuthFooter',
              '.vkc__BottomAuthPanel'
            ];
            
            selectors.forEach(selector => {
              document.querySelectorAll(selector).forEach(el => el.remove());
            });
            
            // Восстанавливаем скролл
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
            document.body.classList.remove('noscroll', 'scroll_fix');
            document.documentElement.classList.remove('noscroll', 'scroll_fix');
          };
          
          // Запускаем сразу
          fixVK();
          
          // Запускаем периодически
          this.bypassAuthInterval = setInterval(fixVK, 500);
        },
        disable: () => {
          this.removeCSS('bypass_auth_popup');
          if (this.bypassAuthInterval) {
            clearInterval(this.bypassAuthInterval);
            this.bypassAuthInterval = null;
          }
        }
      },

      // Авто-добавление друзей
      auto_add_friends: {
        enable: async () => {
          // Проверяем, что мы на странице поиска друзей
          if (!window.location.href.includes('vk.com/friends')) {
            return;
          }
          
          const settings = await this.storage.getAll();
          const maxPerHour = settings.auto_add_limit ?? 50;
          const delayMin = (settings.auto_add_delay_min ?? 20) * 1000;
          const delayMax = (settings.auto_add_delay_max ?? 40) * 1000;
          
          let addCount = 0;
          let isRunning = true;
          
          // Обновляем статус
          const updateStats = () => {
            chrome.storage.local.set({
              auto_add_stats: { added: addCount, isRunning }
            });
          };
          
          // Рандомный скролл к элементу
          const randomScrollTo = (element) => {
            const randomOffset = Math.floor(Math.random() * 501) - 100;
            const elementPosition = element.getBoundingClientRect().top + window.scrollY + randomOffset;
            window.scrollTo({ top: elementPosition, behavior: 'smooth' });
          };
          
          // Рандомная задержка
          const randomDelay = () => {
            return Math.floor(Math.random() * (delayMax - delayMin + 1)) + delayMin;
          };
          
          // Функция добавления друга
          const addFriend = () => {
            if (!isRunning || addCount >= maxPerHour) {
              if (addCount >= maxPerHour) {
                console.log('[VKify] Достигнут лимит добавлений');
              }
              isRunning = false;
              updateStats();
              return;
            }
            
            // Ищем кнопки "Добавить в друзья"
            const addButtons = Array.from(document.querySelectorAll('span.vkuiButton__content, button[class*="Button"]'))
              .filter(btn => {
                const text = btn.textContent.trim().toLowerCase();
                return (text === 'добавить' || text === 'добавить в друзья') && !btn.closest('button')?.disabled;
              });
            
            if (addButtons.length > 0) {
              // Выбираем случайную кнопку
              const randomButton = addButtons[Math.floor(Math.random() * addButtons.length)];
              
              // Скроллим к ней
              randomScrollTo(randomButton);
              
              // Кликаем с задержкой
              setTimeout(() => {
                if (!isRunning) return;
                
                // Находим родительскую кнопку и кликаем
                const clickTarget = randomButton.closest('button') || randomButton;
                clickTarget.click();
                
                addCount++;
                console.log(`[VKify] Добавлен друг! Всего: ${addCount}/${maxPerHour}`);
                updateStats();
                
                // Планируем следующее добавление
                setTimeout(addFriend, randomDelay());
              }, Math.floor(Math.random() * 3000) + 1000);
            } else {
              console.log('[VKify] Нет доступных кнопок, ждём...');
              // Скроллим вниз для подгрузки
              window.scrollBy({ top: 500, behavior: 'smooth' });
              setTimeout(addFriend, 5000);
            }
          };
          
          // Сохраняем функцию остановки
          this.stopAutoAdd = () => {
            isRunning = false;
            updateStats();
          };
          
          // Запускаем
          updateStats();
          setTimeout(addFriend, randomDelay());
          
          console.log('[VKify] Авто-добавление друзей запущено');
        },
        disable: () => {
          if (this.stopAutoAdd) {
            this.stopAutoAdd();
            this.stopAutoAdd = null;
          }
          chrome.storage.local.set({
            auto_add_stats: { added: 0, isRunning: false }
          });
          console.log('[VKify] Авто-добавление друзей остановлено');
        }
      },

    // Анти-«печатает»
    prevent_typing: {
      enable: () => {
        this.injectAntiTrackingScript();
        this.setAntiTrackingFlag('prevent_typing', true);
      },
      disable: () => {
        this.setAntiTrackingFlag('prevent_typing', false);
      }
    },

    // Анти-«прочитано»
    prevent_read: {
      enable: () => {
        this.injectAntiTrackingScript();
        this.setAntiTrackingFlag('prevent_read', true);
      },
      disable: () => {
        this.setAntiTrackingFlag('prevent_read', false);
      }
    },

    // ==================
    // Редактор CSS
    // ==================
    custom_css_enabled: {
      enable: async () => {
        const css = await this.storage.get('custom_css');
        if (css) {
          this.injectCSS('custom_css', css);
        }
      },
      disable: () => {
        this.removeCSS('custom_css');
      }
    },

    custom_css: {
      enable: async (css) => {
        if (!css) return;
        const enabled = await this.storage.get('custom_css_enabled');
        if (enabled) {
          this.injectCSS('custom_css', css);
        }
      },
      disable: () => {
        this.removeCSS('custom_css');
      }
    },

    };

    return handlers[featureId];
  }

  // ==================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ==================

  // Инъекция скрипта анти-слежки через внешний файл
  injectAntiTrackingScript() {
    if (this.antiTrackingInjected) {
      return;
    }
    
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('content/injected.js');
    script.onload = () => {
      script.remove();
      console.log('[VKify] Anti-tracking script injected');
    };
    script.onerror = (e) => {
      console.error('[VKify] Failed to inject anti-tracking script:', e);
    };
    (document.head || document.documentElement).appendChild(script);
    
    this.antiTrackingInjected = true;
  }

  // Установка флага для анти-слежки через CustomEvent (БЕЗ inline скриптов!)
  setAntiTrackingFlag(flag, value) {
    try {
      // Отправляем событие в контекст страницы
      // CustomEvent можно создавать из content script - это не inline код
      const event = new CustomEvent('vkify-update-settings', {
        detail: { [flag]: value }
      });
      window.dispatchEvent(event);
      console.log(`[VKify] Flag ${flag} set to ${value}`);
    } catch (e) {
      console.error('[VKify] Failed to set flag:', e);
    }
  }

  injectCSS(id, css) {
    this.removeCSS(id);
    const style = document.createElement('style');
    style.id = `vkify-${id}`;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    this.styles.set(id, style);
  }

  removeCSS(id) {
    const existing = document.getElementById(`vkify-${id}`);
    if (existing) {
      existing.remove();
    }
    this.styles.delete(id);
  }

  updateLogoColor(color) {
    const findAndMarkLogoPaths = () => {
      // Находим все SVG в логотипах
      const logoContainers = document.querySelectorAll(
        '[class*="Logo__root"] svg, .TopHomeLink svg, a[class*="Logo"] svg'
      );
      
      logoContainers.forEach(svg => {
        const paths = svg.querySelectorAll('path');
        paths.forEach(path => {
          const fill = path.getAttribute('fill');
          // Проверяем, это синий фон (не белый и не currentColor)
          if (fill && (
            fill.toLowerCase() === '#07f' || 
            fill.toLowerCase() === '#0077ff' ||
            fill.toLowerCase() === '#0077FF' ||
            path.hasAttribute('data-vkify-logo-bg')
          )) {
            // Помечаем path и меняем цвет
            path.setAttribute('data-vkify-logo-bg', 'true');
            path.setAttribute('fill', color);
          }
        });
      });
    };
    
    // Сразу применяем
    findAndMarkLogoPaths();
    
    // Повторяем для динамики
    setTimeout(findAndMarkLogoPaths, 100);
    setTimeout(findAndMarkLogoPaths, 500);
    setTimeout(findAndMarkLogoPaths, 1500);
    
    // Наблюдатель за изменениями DOM
    if (this.logoObserver) {
      this.logoObserver.disconnect();
    }
    
    this.logoObserver = new MutationObserver(() => {
      findAndMarkLogoPaths();
    });
    
    const header = document.querySelector('#page_header_wrap, header, #top_nav');
    if (header) {
      this.logoObserver.observe(header, {
        childList: true,
        subtree: true
      });
    }
    
    // Сохраняем текущий цвет для обновлений
    this.currentAccentColor = color;
  }

  resetLogoColor() {
    // Останавливаем наблюдатель
    if (this.logoObserver) {
      this.logoObserver.disconnect();
      this.logoObserver = null;
    }
    
    // Возвращаем оригинальный цвет
    const markedPaths = document.querySelectorAll('[data-vkify-logo-bg="true"]');
    markedPaths.forEach(path => {
      path.setAttribute('fill', '#07F');
      path.removeAttribute('data-vkify-logo-bg');
    });
    
    this.currentAccentColor = null;
  }

  // Режим невидимки
  enablePrivacyMode() {
    const STORAGE_KEY = 'vkify_privacy_active';
    const styleId = 'privacy_mode';
    
    const css = `
      .privacy-mode-active .ConvoList__item,
      .privacy-mode-active .VirtualScrollItem,
      .privacy-mode-active .nim-dialog {
        display: none !important;
      }
      .privacy-mode-active .ConvoList__top,
      .privacy-mode-active .ConvoList__footer,
      .privacy-mode-active .nim-tabs {
        display: none !important;
      }
      .privacy-mode-counter-hidden {
        display: none !important;
      }
      .privacy-mode-active .ConvoMain,
      .privacy-mode-active .ConvoHistory,
      .privacy-mode-active .nim-chat {
        display: none !important;
      }
      .privacy-mode-active .EmptyConvoList,
      .privacy-mode-active .ContentPlaceholder {
        display: flex !important;
      }
    `;
    
    let isHidden = false;
    const self = this;
    
    const applyHide = () => {
      document.querySelectorAll('.ConvoList, .MEApp, .nim-dialog-list').forEach(el => {
        el.classList.add('privacy-mode-active');
      });
      document.querySelectorAll('#l_msg .vkuiCounter__host, #l_msg [class*="Counter"], .im_nav_item .count').forEach(el => {
        el.classList.add('privacy-mode-counter-hidden');
      });
      self.injectCSS(styleId, css);
    };
    
    const applyShow = () => {
      document.querySelectorAll('.privacy-mode-active').forEach(el => {
        el.classList.remove('privacy-mode-active');
      });
      document.querySelectorAll('.privacy-mode-counter-hidden').forEach(el => {
        el.classList.remove('privacy-mode-counter-hidden');
      });
      self.removeCSS(styleId);
    };
    
    const toggle = async () => {
      isHidden = !isHidden;
      await self.storage.set(STORAGE_KEY, isHidden);
      if (isHidden) {
        applyHide();
      } else {
        applyShow();
      }
      console.log(`[VKify] Privacy mode: ${isHidden ? 'ON 🔒' : 'OFF 🔓'}`);
    };
    
    const keyHandler = (e) => {
      if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.key === 'q' || e.key === 'й' || e.code === 'KeyQ')) {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    };
    
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible' && isHidden) {
        setTimeout(applyHide, 50);
      }
    };
    
    if (window._vkifyPrivacyHandlers) {
      document.removeEventListener('keydown', window._vkifyPrivacyHandlers.key, true);
      document.removeEventListener('visibilitychange', window._vkifyPrivacyHandlers.visibility);
    }
    
    window._vkifyPrivacyHandlers = { key: keyHandler, visibility: visibilityHandler };
    
    document.addEventListener('keydown', keyHandler, true);
    document.addEventListener('visibilitychange', visibilityHandler);
    
    this.storage.onChange((key, value) => {
      if (key === STORAGE_KEY) {
        isHidden = value === true;
        if (isHidden) { applyHide(); } else { applyShow(); }
      }
    });
    
    (async () => {
      isHidden = await self.storage.get(STORAGE_KEY, false);
      if (isHidden) {
        applyHide();
        setTimeout(applyHide, 100);
        setTimeout(applyHide, 500);
      }
    })();
    
    this.observers.set('privacy_mode', {
      keyHandler,
      visibilityHandler,
      applyShow,
      storageKey: STORAGE_KEY
    });
    
    console.log('[VKify] Privacy mode ready. Press Ctrl+Q to toggle.');
  }

  disablePrivacyMode() {
    const data = this.observers.get('privacy_mode');
    if (data) {
      document.removeEventListener('keydown', data.keyHandler, true);
      document.removeEventListener('visibilitychange', data.visibilityHandler);
      data.applyShow();
      this.storage.set(data.storageKey, false);
      this.observers.delete('privacy_mode');
    }
    if (window._vkifyPrivacyHandlers) {
      delete window._vkifyPrivacyHandlers;
    }
    this.removeCSS('privacy_mode');
    console.log('[VKify] Privacy mode disabled.');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FeatureManager };
}