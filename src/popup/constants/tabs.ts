// Ярлык вкладки локализован — не хранится здесь строкой, а берётся по id из
// namespace `settings` (`settings.tabs.<id>`) в точке рендера (Tabs.tsx /
// SearchPalette.tsx). Тут остаются только стабильные id и имя иконки.
export interface TabDef {
  id: string;
  icon: string;
}

export const TABS: TabDef[] = [
  { id: 'appearance', icon: 'palette'     },
  { id: 'hiding',     icon: 'layout'      },
  { id: 'center',     icon: 'layout-rows' },
  { id: 'notes',      icon: 'bookmark'    },
  { id: 'privacy',    icon: 'shield'      },
  { id: 'onlinespy',  icon: 'activity'    },
  { id: 'scripts',    icon: 'zap'         },
  { id: 'ads',        icon: 'ban'         },
  { id: 'css',        icon: 'code'        },
  { id: 'more',       icon: 'settings'    },
];