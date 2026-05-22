import React, { useState, useCallback } from 'react';
import SettingRow from '../ui/SettingRow.js';
import InfoBlock from '../ui/InfoBlock.js';
import AddUserModal from '../modals/AddUserModal.js';
import HotkeyPicker from '../ui/HotkeyPicker.js';
import { LockIcon, EyeOffIcon, SkeletonIcon, EditIcon, CheckIcon, BlurIcon, XIcon, PlusIcon, BookOpenIcon, MessageCircleIcon } from '../icons/Icons.js';
import { useSettings } from '../../context/SettingsContext.js';
import { useHiddenDialogs } from '../../hooks/features/useHiddenDialogs.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import { useFriends } from '../../hooks/features/useFriends.js';
import { useConversations } from '../../hooks/features/useConversations.js';
import type { FriendItem } from '../../hooks/features/useFriends.js';
import type { ConversationItem } from '../../hooks/features/useConversations.js';
import type { HiddenDialog, HotkeyCombo } from '../../../types/index.js';

const DEFAULT_HIDE_DIALOGS_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'KeyQ', label: 'Ctrl+Q',
};

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

interface PrivacySetting {
  id: string;
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  iconColor: IconColor;
}

interface FeatureDescription {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: React.ReactNode;
}

const PRIVACY: PrivacySetting[] = [
  {
    id: 'prevent_typing',
    title: 'Не показывать «печатает»',
    description: 'Собеседник не увидит что вы печатаете',
    icon: <EditIcon className="w-5 h-5" />,
    iconColor: 'purple',
  },
  {
    id: 'prevent_read',
    title: 'Не отмечать прочитанным',
    description: 'Сообщения останутся непрочитанными',
    icon: <CheckIcon className="w-5 h-5" />,
    iconColor: 'blue',
  },
  {
    id: 'skeleton_mode',
    title: 'Режим скелетона',
    description: 'Скрыть аватары, имена и текст',
    icon: <SkeletonIcon className="w-5 h-5" />,
    iconColor: 'orange',
  },
  {
    id: 'blur_on_unfocus',
    title: 'Размытие при отходе',
    description: 'Размыть страницу, когда курсор покидает окно VK',
    icon: <BlurIcon className="w-5 h-5" />,
    iconColor: 'cyan',
  },
];

const FEATURE_DESCRIPTIONS: FeatureDescription[] = [
  {
    icon: <LockIcon className="w-5 h-5 text-purple-500" />,
    iconBg: 'bg-purple-500/10',
    title: 'Статус «печатает»',
    description: 'Блокирует отправку индикатора набора текста. Собеседник не узнает, что вы пишете сообщение, пока вы его не отправите.',
  },
  {
    icon: <CheckIcon className="w-5 h-5 text-blue-500" />,
    iconBg: 'bg-blue-500/10',
    title: 'Прочтение сообщений',
    description: 'Сообщения не будут отмечаться как прочитанные. Собеседник увидит галочки только когда вы сами этого захотите.',
  },
  {
    icon: <EyeOffIcon className="w-5 h-5 text-purple-500" />,
    iconBg: 'bg-purple-500/10',
    title: 'Горячие клавиши',
    description: 'Все диалоги мгновенно скрываются по заданной горячей клавише. Повторное нажатие возвращает их обратно. Удобно, когда кто-то смотрит на экран.',
  },
  {
    icon: <SkeletonIcon className="w-5 h-5 text-orange-500" />,
    iconBg: 'bg-orange-500/10',
    title: 'Режим скелетона',
    description: 'Заменяет все аватары, имена и текст сообщений на серые плейсхолдеры. Полная анонимность содержимого экрана.',
  },
  {
    icon: <BlurIcon className="w-5 h-5 text-cyan-500" />,
    iconBg: 'bg-cyan-500/10',
    title: 'Автоматическое размытие',
    description: 'Когда курсор мыши покидает окно браузера, страница автоматически размывается. Защита от случайных взглядов.',
  },
];


interface HiddenDialogCardProps {
  dialog: HiddenDialog;
  onRemove: (id: string) => void;
}

function HiddenDialogCard({ dialog, onRemove }: HiddenDialogCardProps) {
  return (
    <div className="p-3 bg-[var(--bg-secondary)] rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-full flex-shrink-0">
            {dialog.photo ? (
              <img src={dialog.photo} alt={dialog.name} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">{dialog.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--text-primary)] truncate">{dialog.name}</div>
            <div className="text-xs text-[var(--text-tertiary)]">ID: {dialog.id}</div>
          </div>
        </div>
        <button
          onClick={() => onRemove(dialog.id)}
          className="p-2 text-[var(--text-tertiary)] hover:text-error hover:bg-error/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}


function HiddenDialogsSection(): React.ReactElement {
  const { hiddenDialogs, hiddenIds, addDialog, toggleDialog, removeDialog } = useHiddenDialogs();
  const { hasToken, call } = useVKApi();
  const { friends, filtered: filteredFriends, loading: friendsLoading, search: friendsSearch, setSearch: setFriendsSearch, load: loadFriends } = useFriends(hasToken, call);
  const { filtered: filteredConversations, loading: conversationsLoading, search: conversationsSearch, setSearch: setConversationsSearch, load: loadConversations } = useConversations(hasToken, call);

  const [showModal, setShowModal] = useState(false);

  const handleToggleFriend = (friend: FriendItem): void => {
    toggleDialog(String(friend.id), friend.name, friend.photo);
  };

  const handleToggleConversation = (item: ConversationItem): void => {
    toggleDialog(String(item.id), item.name, item.photo);
  };

  return (
    <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        {/* MessageCircleIcon — секция про диалоги/чаты (EyeOffIcon уже занят у SettingRow «Скрытие диалогов») */}
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
          <MessageCircleIcon className="w-5 h-5 text-purple-500" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Скрытые диалоги</h3>
          {hiddenDialogs.length > 0 && (
            <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-purple-500">
              <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
              {hiddenDialogs.length} скрыто
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--text-secondary)] px-4 pb-3 leading-relaxed">
        Диалоги с указанными пользователями будут полностью скрыты через CSS.
      </p>

      <div className="mx-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            Скрытые пользователи ({hiddenDialogs.length})
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Добавить
          </button>
        </div>

        {hiddenDialogs.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {hiddenDialogs.map(dialog => (
              <HiddenDialogCard
                key={dialog.id}
                dialog={dialog}
                onRemove={removeDialog}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-[var(--bg-secondary)] rounded-xl">
            <EyeOffIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-tertiary)] mb-1">Нет скрытых пользователей</p>
            <p className="text-xs text-[var(--text-tertiary)]">Добавьте друзей чтобы скрыть их диалоги</p>
          </div>
        )}
      </div>

      {showModal && (
        <AddUserModal
          title="Скрыть диалог"
          trackedIds={hiddenIds}
          hasToken={hasToken}
          friends={friends}
          friendsLoading={friendsLoading}
          friendsSearch={friendsSearch}
          filteredFriends={filteredFriends}
          trackedUsersCount={hiddenDialogs.length}
          onSearchChange={setFriendsSearch}
          onLoadFriends={() => void loadFriends()}
          onToggleFriend={handleToggleFriend}
          onAddManual={addDialog}
          onClose={() => setShowModal(false)}
          conversations={filteredConversations}
          conversationsLoading={conversationsLoading}
          conversationsSearch={conversationsSearch}
          filteredConversations={filteredConversations}
          onConversationSearchChange={setConversationsSearch}
          onLoadConversations={() => void loadConversations()}
          onToggleConversation={handleToggleConversation}
        />
      )}
    </section>
  );
}


export default function PrivacyTab(): React.ReactElement {
  const { settings, saveSetting } = useSettings();
  const hideDialogsHotkey = (settings['hide_dialogs_hotkey_combo'] as HotkeyCombo | undefined) ?? DEFAULT_HIDE_DIALOGS_HOTKEY;

  const handleHideDialogsHotkeyChange = useCallback((combo: HotkeyCombo): void => {
    void saveSetting('hide_dialogs_hotkey_combo', combo);
  }, [saveSetting]);

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <LockIcon className="w-5 h-5 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Приватность</h3>
        </div>

        {PRIVACY.map((filter, index) => (
          <React.Fragment key={filter.id}>
            <SettingRow
              id={filter.id}
              title={filter.title}
              description={filter.description}
              icon={filter.icon}
              iconColor={filter.iconColor}
            />
            {index < PRIVACY.length - 1 && (
              <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
            )}
          </React.Fragment>
        ))}

        {/* hide_dialogs_hotkey — отдельно, чтобы добавить HotkeyPicker */}
        <div className="mx-3 border-t border-[var(--border-color)] opacity-50" />
        <SettingRow
          id="hide_dialogs_hotkey"
          title="Скрытие диалогов"
          description="Мгновенно скрыть / показать все диалоги"
          icon={<EyeOffIcon className="w-5 h-5" />}
          iconColor="purple"
        />
        {settings['hide_dialogs_hotkey'] === true && (
          <div className="px-4 pb-4 pt-1 flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">Горячая клавиша</span>
            <HotkeyPicker
              value={hideDialogsHotkey}
              defaultValue={DEFAULT_HIDE_DIALOGS_HOTKEY}
              onChange={handleHideDialogsHotkeyChange}
            />
          </div>
        )}
      </section>

      <HiddenDialogsSection />

      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <BookOpenIcon className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">Как это работает</h3>
        </div>

        <div className="p-4 pt-2 space-y-4">
          {FEATURE_DESCRIPTIONS.map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${feature.iconBg} flex items-center justify-center flex-shrink-0`}>
                {feature.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-[var(--text-primary)] mb-1">
                  {feature.title}
                </h4>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <InfoBlock variant="warning" icon="⚠️" title="Важно помнить">
        Функции приватности работают только на вашей стороне и не гарантируют 100% защиту.
        Используйте их как дополнительный слой конфиденциальности.
      </InfoBlock>
    </div>
  );
}