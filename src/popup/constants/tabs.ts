export interface TabDef {
  id: string;
  label: string;
  icon: string;
}

export const TABS: TabDef[] = [
  { id: 'appearance', label: 'Вид',          icon: 'palette'  },
  { id: 'elements',   label: 'Элементы',     icon: 'layout'   },
  { id: 'center',     label: 'Центр',        icon: 'layout-rows' },
  { id: 'notes',      label: 'Заметки',      icon: 'bookmark' },
  { id: 'privacy',    label: 'Приватность',  icon: 'shield'   },
  { id: 'media',      label: 'Медиа',        icon: 'music'    },
  { id: 'onlinespy',  label: 'Слежка',       icon: 'activity' },
  { id: 'scripts',    label: 'Скрипты',      icon: 'zap'      },
  { id: 'ads',        label: 'Реклама',      icon: 'ban'      },
  { id: 'css',        label: 'CSS',          icon: 'code'     },
  { id: 'more',       label: 'Ещё',          icon: 'settings' },
];