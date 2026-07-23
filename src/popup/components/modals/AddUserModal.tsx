import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../ui/Modal.js';
import { XIcon, SearchIcon, CheckIcon } from '../icons/Icons.js';
import type { FriendItem } from '../../hooks/features/useFriends.js';
import type { ConversationItem } from '../../hooks/features/useConversations.js';

interface AddUserModalProps {
  title?: string;
  trackedIds: Set<string>;
  hasToken: boolean;
  // Friends
  friends: FriendItem[];
  friendsLoading: boolean;
  friendsSearch: string;
  filteredFriends: FriendItem[];
  trackedUsersCount: number;
  onSearchChange: (value: string) => void;
  onLoadFriends: () => void;
  onToggleFriend: (friend: FriendItem) => void;
  onAddManual: (userId: string, name?: string) => boolean;
  onClose: () => void;
  // Conversations (optional — tab hidden when not provided)
  conversations?: ConversationItem[];
  conversationsLoading?: boolean;
  conversationsSearch?: string;
  filteredConversations?: ConversationItem[];
  onConversationSearchChange?: (value: string) => void;
  onLoadConversations?: () => void;
  onToggleConversation?: (item: ConversationItem) => void;
}

type Tab = 'friends' | 'conversations' | 'manual';

export default function AddUserModal({
  title,
  trackedIds,
  hasToken,
  friends,
  friendsLoading,
  friendsSearch,
  filteredFriends,
  trackedUsersCount,
  onSearchChange,
  onLoadFriends,
  onToggleFriend,
  onAddManual,
  onClose,
  conversations,
  conversationsLoading,
  conversationsSearch,
  filteredConversations,
  onConversationSearchChange,
  onLoadConversations,
  onToggleConversation,
}: AddUserModalProps) {
  const { t } = useTranslation('modals');
  const modalTitle = title ?? t('add_user.title_default');
  const hasConversations = onToggleConversation !== undefined;
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [manualId, setManualId] = useState('');
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    if (hasToken && friends.length === 0) {
      onLoadFriends();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = (): void => {
    onSearchChange('');
    onConversationSearchChange?.('');
    onClose();
  };

  const handleAddManual = (): void => {
    if (!manualId.trim()) return;
    const ok = onAddManual(manualId, manualName);
    if (ok) {
      setManualId('');
      setManualName('');
      handleClose();
    }
  };

  const handleConversationsTabClick = (): void => {
    setActiveTab('conversations');
    if (hasToken && (conversations?.length ?? 0) === 0) {
      onLoadConversations?.();
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'friends', label: t('add_user.tab_friends') },
    ...(hasConversations ? [{ key: 'conversations' as Tab, label: t('add_user.tab_conversations') }] : []),
    { key: 'manual', label: t('add_user.tab_manual') },
  ];

  return (
    <Modal bare ariaLabel={modalTitle} onClose={handleClose}>
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-md shadow-2xl border border-[var(--border-color)] max-h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{modalTitle}</h3>
          <button
            onClick={handleClose}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-[var(--border-color)]">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={tab.key === 'conversations' ? handleConversationsTabClick : () => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'friends' && (
          <>
            <div className="p-4 pb-2">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={friendsSearch}
                  onChange={e => onSearchChange(e.target.value)}
                  placeholder={t('add_user.search_placeholder')}
                  className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {friendsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !hasToken ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--text-tertiary)]">{t('add_user.open_vk_friends')}</p>
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--text-tertiary)]">
                    {friendsSearch ? t('nothing_found') : t('add_user.no_friends')}
                  </p>
                </div>
              ) : (
                <UserList
                  items={filteredFriends.map(f => ({ id: f.id, name: f.name, photo: f.photo, online: f.online }))}
                  trackedIds={trackedIds}
                  onToggle={item => onToggleFriend(filteredFriends.find(f => f.id === item.id)!)}
                />
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-color)]">
              <button
                onClick={handleClose}
                className="w-full py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
              >
                {t('add_user.done', { count: trackedUsersCount })}
              </button>
            </div>
          </>
        )}

        {activeTab === 'conversations' && hasConversations && (
          <>
            <div className="p-4 pb-2">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  value={conversationsSearch ?? ''}
                  onChange={e => onConversationSearchChange?.(e.target.value)}
                  placeholder={t('add_user.search_placeholder')}
                  className="w-full pl-9 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !hasToken ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--text-tertiary)]">{t('add_user.open_vk_convos')}</p>
                </div>
              ) : (filteredConversations?.length ?? 0) === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--text-tertiary)]">
                    {conversationsSearch ? t('nothing_found') : t('add_user.no_convos')}
                  </p>
                </div>
              ) : (
                <UserList
                  items={(filteredConversations ?? []).map(c => ({ id: c.id, name: c.name, photo: c.photo }))}
                  trackedIds={trackedIds}
                  onToggle={item => onToggleConversation?.(filteredConversations!.find(c => c.id === item.id)!)}
                />
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-color)]">
              <button
                onClick={handleClose}
                className="w-full py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
              >
                {t('add_user.done', { count: trackedUsersCount })}
              </button>
            </div>
          </>
        )}

        {activeTab === 'manual' && (
          <>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('add_user.id_label')}
                </label>
                <input
                  type="text"
                  value={manualId}
                  onChange={e => setManualId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddManual()}
                  placeholder={t('add_user.id_placeholder')}
                  className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('add_user.name_label')}
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={e => setManualName(e.target.value)}
                  placeholder={t('add_user.name_placeholder')}
                  className="w-full px-3 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('add_user.id_hint')}{' '}
                vk.ru/id<span className="text-primary">123456789</span>
              </p>
            </div>

            <div className="flex gap-3 p-4 border-t border-[var(--border-color)] mt-auto">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleAddManual}
                disabled={!manualId.trim()}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors disabled:opacity-50"
              >
                {t('add')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}


interface UserRowItem {
  id: number;
  name: string;
  photo?: string;
  online?: boolean;
}

function UserList({ items, trackedIds, onToggle }: {
  items: UserRowItem[];
  trackedIds: Set<string>;
  onToggle: (item: UserRowItem) => void;
}) {
  return (
    <div className="space-y-1">
      {items.map(item => {
        const isTracked = trackedIds.has(String(item.id));
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all ${
              isTracked ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-[var(--bg-secondary)]'
            }`}
          >
            <div className="relative flex-shrink-0">
              {item.photo ? (
                <img src={item.photo} alt={item.name} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">{item.name.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {item.online && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success border-2 border-[var(--bg-primary)] rounded-full" />
              )}
            </div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-[var(--text-primary)] truncate">{item.name}</div>
              <div className="text-xs text-[var(--text-tertiary)]">ID: {item.id}</div>
            </div>
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
              isTracked ? 'bg-primary text-white' : 'bg-[var(--bg-tertiary)] text-transparent'
            }`}>
              <CheckIcon className="w-4 h-4" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
