import React from 'react';
import { useTranslation } from 'react-i18next';
import HidingSection from '../HidingSection.js';
import { CommentIcon, MenuVideoIcon, LayoutRowsIcon, FilterIcon, UserPlusIcon } from '@/popup/components/icons/Icons.js';
import { VIDEO_HIDING_KEYS } from '@/shared/constants/video-hiding.js';

const ICONS = [CommentIcon, MenuVideoIcon, LayoutRowsIcon, LayoutRowsIcon, FilterIcon, UserPlusIcon];
export default function VideoPage(): React.ReactElement {
  const { t } = useTranslation('hiding');
  return <HidingSection title={t('rail.video')} elements={VIDEO_HIDING_KEYS.map((id, index) => {
    const Icon = ICONS[index];
    return { id, title: t(`items.${id}.title`), icon: <Icon className="w-5 h-5" /> };
  })} />;
}
