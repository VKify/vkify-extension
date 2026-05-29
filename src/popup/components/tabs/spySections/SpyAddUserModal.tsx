import React from 'react';
import AddUserModal from '../../modals/AddUserModal.js';
import type { SpyLists, SpyTargetApi } from './types.js';

/**
 * Тонкая обёртка над AddUserModal: проводит разделяемые списки друзей/диалогов
 * и API цели слежки в ~20 пропов модалки. Используется всеми тремя секциями.
 */
export default function SpyAddUserModal({
  lists,
  target,
  title,
  onClose,
}: {
  lists: SpyLists;
  target: SpyTargetApi;
  title?: string;
  onClose: () => void;
}) {
  const { friends, conversations, hasToken } = lists;

  return (
    <AddUserModal
      title={title}
      trackedIds={target.trackedIds}
      hasToken={hasToken}
      friends={friends.friends}
      friendsLoading={friends.loading}
      friendsSearch={friends.search}
      filteredFriends={friends.filtered}
      trackedUsersCount={target.trackedUsers.length}
      onSearchChange={friends.setSearch}
      onLoadFriends={() => void friends.load()}
      onToggleFriend={f => target.toggleUser(String(f.id), f.name, f.photo)}
      onAddManual={target.addUser}
      onClose={onClose}
      conversations={conversations.conversations}
      conversationsLoading={conversations.loading}
      conversationsSearch={conversations.search}
      filteredConversations={conversations.filtered}
      onConversationSearchChange={conversations.setSearch}
      onLoadConversations={() => void conversations.load()}
      onToggleConversation={c => target.toggleUser(String(c.id), c.name, c.photo)}
    />
  );
}
