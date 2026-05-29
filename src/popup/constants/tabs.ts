export interface TabDef {
  id: string;
  label: string;
  icon: string;
}

export const TABS: TabDef[] = [
  { id: 'appearance', label: 'Вид',          icon: 'palette'  },
  { id: 'elements',   label: 'Элементы',     icon: 'layout'   },
  { id: 'privacy',    label: 'Приватность',  icon: 'shield'   },
  { id: 'ads',        label: 'Реклама',      icon: 'ban'      },
  { id: 'scripts',    label: 'Скрипты',      icon: 'zap'      },
  { id: 'media',      label: 'Медиа',        icon: 'music'    },
  { id: 'onlinespy',  label: 'Слежка',       icon: 'activity' },
  { id: 'center',     label: 'Центр',        icon: 'layout-rows' },
  { id: 'css',        label: 'CSS',          icon: 'code'     },
  { id: 'more',       label: 'Ещё',          icon: 'settings' },
];