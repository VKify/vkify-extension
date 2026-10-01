import React from 'react';
import {
  ActivityIcon, ImageIcon, MessageIcon, UsersIcon, UserPlusIcon, ProfileIcon,
  KeyboardIcon, MicIcon, ClapperboardIcon, AttachIcon, PhoneIcon, TrashIcon,
  EditIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, CancelCircleIcon,
} from './Icons.js';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  activity: ActivityIcon,
  avatar: ImageIcon, photo: ImageIcon, status: MessageIcon, message: MessageIcon,
  friends_added: UserPlusIcon, friends_removed: UsersIcon, profile: ProfileIcon,
  chat: UsersIcon, typing: KeyboardIcon, voice: MicIcon, video: ClapperboardIcon,
  attach: AttachIcon, call: PhoneIcon, delete: TrashIcon, edit: EditIcon,
  read: EyeIcon, hidden: EyeOffIcon, online: CheckCircleIcon, offline: CancelCircleIcon,
};

// Read old histories without mutating stored records or interpreting message text.
// Ignore variation selectors: browsers used both text and emoji presentations.
const LEGACY_IDS: Record<string, string> = {
  '🖼': 'photo', '💬': 'message', '👥': 'friends_added', '👤': 'profile',
  '⌨': 'typing', '🎤': 'voice', '📷': 'photo', '🎥': 'video', '📹': 'video',
  '📎': 'attach', '📞': 'call', '🗑': 'delete', '✏': 'edit',
  '👁': 'read', '👀': 'read', '👻': 'hidden', '🟢': 'online', '⚫': 'offline', '🔴': 'offline',
};

export function resolveSpyEventIconId(id?: string): string {
  const normalized = (id ?? '').replace(/[\uFE0E\uFE0F]/g, '');
  const resolved = LEGACY_IDS[normalized] ?? normalized;
  return Object.prototype.hasOwnProperty.call(ICONS, resolved) ? resolved : 'activity';
}

export default function SpyEventIcon({ id }: { id: string }): React.ReactElement {
  const resolved = resolveSpyEventIconId(id);
  const Icon = ICONS[resolved] ?? ActivityIcon;
  const color = resolved === 'online' ? 'text-success'
    : resolved === 'offline' ? 'text-[var(--text-tertiary)]' : 'text-primary';
  return <span data-spy-event-icon={resolved} aria-hidden="true" className={`inline-flex flex-none ${color}`}>
    <Icon className="w-4 h-4" />
  </span>;
}
