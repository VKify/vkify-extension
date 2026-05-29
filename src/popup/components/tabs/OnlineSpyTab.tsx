import React from 'react';
import InfoBlock from '../ui/InfoBlock.js';
import ActivitySpySection from './spySections/ActivitySpySection.js';
import OnlineSpySection from './spySections/OnlineSpySection.js';
import ProfileSpySection from './spySections/ProfileSpySection.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import { useFriends } from '../../hooks/features/useFriends.js';
import { useConversations } from '../../hooks/features/useConversations.js';
import type { SpyLists } from './spySections/types.js';

export default function OnlineSpyTab() {
  const { hasToken, call } = useVKApi();

  // Друзья и диалоги грузятся один раз и переиспользуются всеми тремя
  // секциями (каждая открывает свою AddUserModal над общими списками).
  const friends = useFriends(hasToken, call);
  const conversations = useConversations(hasToken, call);
  const lists: SpyLists = { hasToken, friends, conversations };

  return (
    <div className="space-y-4">
      <ActivitySpySection lists={lists} />
      <OnlineSpySection lists={lists} />
      <ProfileSpySection lists={lists} />

      <InfoBlock variant="info" icon="ℹ️" title="Как это работает">
        Онлайн-мониторинг проверяет статус пользователей через VK API с выбранным интервалом.
        Данные о посещениях сохраняются в течение 7 дней для построения графиков активности.
      </InfoBlock>
    </div>
  );
}
