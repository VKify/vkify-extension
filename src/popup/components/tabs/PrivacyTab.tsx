import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SettingRow from '../ui/SettingRow.js';
import NestedSettings from '../ui/NestedSettings.js';
import InfoBlock from '../ui/InfoBlock.js';
import SubpageHost, { type Subpage } from '../ui/SubpageHost.js';
import NavRow from '../ui/NavRow.js';
import SettingsSection from '../ui/SettingsSection.js';
import AddUserModal from '../modals/AddUserModal.js';
import HotkeyPicker from '../ui/HotkeyPicker.js';
import { LockIcon, EyeOffIcon, EditIcon, CheckIcon, BlurIcon, XIcon, PlusIcon, MessageCircleIcon, WarningIcon, InfoIcon } from '../icons/Icons.js';
import { useVKifyStore } from '../../store/index.js';
import { useToast } from '../../context/ToastContext.js';
import { useHiddenDialogs } from '../../hooks/features/useHiddenDialogs.js';
import { useOnlineStatus } from '../../hooks/features/useOnlineStatus.js';
import { useVKApi } from '../../hooks/core/useVKApi.js';
import { useFriends } from '../../hooks/features/useFriends.js';
import { useConversations } from '../../hooks/features/useConversations.js';
import type { FriendItem } from '../../hooks/features/useFriends.js';
import type { ConversationItem } from '../../hooks/features/useConversations.js';
import type { HiddenDialog, HotkeyCombo } from '@/types/index.js';

const DEFAULT_HIDE_DIALOGS_HOTKEY: HotkeyCombo = {
  ctrlKey: true, shiftKey: false, altKey: false, code: 'KeyQ', label: 'Ctrl+Q',
};

type IconColor = 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'cyan' | 'pink';

interface PrivacySetting {
  id: string;
  icon: React.ReactNode;
  iconColor: IconColor;
}

const PRIVACY: PrivacySetting[] = [
  {
    id: 'prevent_typing',
    icon: <EditIcon className="w-5 h-5" />,
    iconColor: 'purple',
  },
  {
    id: 'prevent_read',
    icon: <CheckIcon className="w-5 h-5" />,
    iconColor: 'blue',
  },
  {
    id: 'blur_on_unfocus',
    icon: <BlurIcon className="w-5 h-5" />,
    iconColor: 'cyan',
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


function HiddenDialogsSection({ asPage = false }: { asPage?: boolean }): React.ReactElement {
  const { t } = useTranslation('privacy');
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
    <section
      {...(asPage ? {} : { 'data-vkify-anchor': 'hidden_dialogs' })}
      className={`bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden ${asPage ? 'pt-2' : ''}`}
    >
      {!asPage && (
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          {/* MessageCircleIcon — секция про диалоги/чаты (EyeOffIcon уже занят у SettingRow «Скрытие диалогов») */}
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <MessageCircleIcon className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('hidden.title')}</h3>
            {hiddenDialogs.length > 0 && (
              <span className="flex items-center gap-1 mt-0.5 text-xs font-medium text-purple-500">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                {t('hidden_count', { count: hiddenDialogs.length })}
              </span>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-[var(--text-secondary)] px-4 pb-3 pt-1 leading-relaxed">
        {t('hidden.intro')}
      </p>

      <div className="mx-4 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            {t('hidden.list_label', { count: hiddenDialogs.length })}
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            {t('hidden.add')}
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
            <p className="text-sm text-[var(--text-tertiary)] mb-1">{t('hidden.empty')}</p>
            <p className="text-xs text-[var(--text-tertiary)]">{t('hidden.empty_hint')}</p>
          </div>
        )}
      </div>

      {showModal && (
        <AddUserModal
          title={t('hidden.modal_title')}
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
  const { t } = useTranslation('privacy');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const hideDialogsHotkey = (settings['hide_dialogs_hotkey_combo'] as HotkeyCombo | undefined) ?? DEFAULT_HIDE_DIALOGS_HOTKEY;

  const cryptoEnabled = settings['message_crypto'] === true;
  const cryptoFormat = (settings['message_crypto_format'] as 'COFFEE' | 'VKify' | undefined) ?? 'VKify';
  const hiddenCount = ((settings['hidden_dialogs'] as unknown[] | undefined) ?? []).length;

  const handleHideDialogsHotkeyChange = useCallback((combo: HotkeyCombo): void => {
    void saveSetting('hide_dialogs_hotkey_combo', combo);
  }, [saveSetting]);

  const subpages: Subpage[] = [
    {
      id: 'crypto',
      title: t('crypto.title'),
      subtitle: t('crypto.subtitle'),
      icon: <LockIcon className="w-5 h-5" />,
      iconColor: 'green',
      anchors: ['message_crypto'],
      render: () => <MessageCryptoPage />,
    },
    {
      id: 'hidden',
      title: t('hidden.title'),
      subtitle: t('hidden.subtitle'),
      icon: <MessageCircleIcon className="w-5 h-5" />,
      iconColor: 'purple',
      anchors: ['hidden_dialogs'],
      render: () => <div data-vkify-anchor="hidden_dialogs"><HiddenDialogsSection asPage /></div>,
    },
  ];

  return (
    <SubpageHost subpages={subpages}>
    <div className="space-y-4">
      <section className="bg-[var(--bg-primary)] rounded-2xl shadow-card overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 ring-1 ring-inset ring-violet-500/20 flex items-center justify-center flex-shrink-0">
            <LockIcon className="w-5 h-5 text-violet-500" />
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('section')}</h3>
        </div>

        {/* Шифрование сообщений — отдельная страница */}
        <NavRow
          subpage="crypto"
          title={t('crypto.title')}
          description={t('crypto.subtitle')}
          icon={<LockIcon className="w-5 h-5" />}
          iconColor="green"
          meta={cryptoEnabled ? (cryptoFormat === 'COFFEE' ? 'COFFEE' : 'VKify E2E') : t('off')}
        />
        <div className="mx-3 border-t border-[var(--border-color)]" />

        {/* Онлайн-статус (невидимка) */}
        <OnlineStatusControl />
        <div className="mx-3 border-t border-[var(--border-color)]" />

        {PRIVACY.map((filter, index) => (
          <React.Fragment key={filter.id}>
            <SettingRow
              id={filter.id}
              title={t(`items.${filter.id}.title`)}
              description={t(`items.${filter.id}.desc`)}
              icon={filter.icon}
              iconColor={filter.iconColor}
            />
            {index < PRIVACY.length - 1 && (
              <div className="mx-3 border-t border-[var(--border-color)]" />
            )}
          </React.Fragment>
        ))}

        {/* hide_dialogs_hotkey — отдельно, чтобы добавить HotkeyPicker */}
        <div className="mx-3 border-t border-[var(--border-color)]" />
        <SettingRow
          id="hide_dialogs_hotkey"
          title={t('panic.title')}
          description={t('panic.desc')}
          icon={<EyeOffIcon className="w-5 h-5" />}
          iconColor="purple"
        />
        {settings['hide_dialogs_hotkey'] === true && (
          <NestedSettings accent="purple">
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-[var(--text-tertiary)]">{t('hotkey')}</span>
              <HotkeyPicker
                value={hideDialogsHotkey}
                defaultValue={DEFAULT_HIDE_DIALOGS_HOTKEY}
                onChange={handleHideDialogsHotkeyChange}
              />
            </div>
          </NestedSettings>
        )}
      </section>

      <SettingsSection>
        <NavRow
          subpage="hidden"
          title={t('hidden.title')}
          description={t('hidden.subtitle')}
          icon={<MessageCircleIcon className="w-5 h-5" />}
          iconColor="purple"
          meta={hiddenCount > 0 ? t('hidden_count', { count: hiddenCount }) : undefined}
        />
      </SettingsSection>

      <InfoBlock variant="warning" icon={<WarningIcon className="w-4 h-4" />} title={t('warn_title')}>
        {t('warn_body')}
      </InfoBlock>
    </div>
    </SubpageHost>
  );
}

// ── Онлайн-статус: невидимка через account.setPrivacy(key=online) ─────────

function OnlineStatusControl(): React.ReactElement {
  const { t } = useTranslation('privacy');
  const { hasToken, call } = useVKApi();
  const { showToast } = useToast();
  const { hidden, loading, busy, toggle } = useOnlineStatus(hasToken, call);

  const handleToggle = useCallback(async (next: boolean): Promise<void> => {
    if (!hasToken) {
      showToast(t('online.no_token'), 'warning');
      return;
    }
    try {
      await toggle(next);
      showToast(next ? t('online.toast_hidden') : t('online.toast_shown'), 'success');
    } catch (e) {
      showToast(t('online.toast_error', { msg: (e as Error).message }), 'error');
    }
  }, [hasToken, toggle, showToast, t]);

  return (
    <SettingRow
      id="hide_online"
      title={t('online.title')}
      description={t('online.desc')}
      icon={<EyeOffIcon className="w-5 h-5" />}
      iconColor="green"
      checked={hidden === true}
      onToggle={(v) => void handleToggle(v)}
      disabled={loading || busy}
    />
  );
}

// ── Шифрование сообщений (внутри секции "Приватность") ────────────────────

const CRYPTO_FORMATS = [
  {
    value: 'COFFEE' as const,
    emoji: '☕',
    label: 'COFFEE',
    algo: 'AES-128-ECB',
    compat: 'Kate Mobile · VK Coffee · Laney · Vika',
    color: 'text-amber-500',
    ring: 'border-amber-500',
    bg: 'bg-amber-500/10',
    keyLabel: 'Key (optional)',
    keyHint: "Without a key, the protocol's public key is used, compatible with Kate Mobile and VK Coffee by default.",
    keyPlaceholder: 'Leave empty for compatibility with Kate Mobile / VK Coffee…',
  },
  {
    value: 'VKify' as const,
    emoji: '🔐',
    label: 'VKify E2E',
    algo: 'AES-256-GCM',
    compat: 'VKify ↔ VKify only',
    color: 'text-green-500',
    ring: 'border-green-500',
    bg: 'bg-green-500/10',
    keyLabel: 'Password (required)',
    keyHint: 'The password must match on the sender and recipient sides. Without a password, VKify encryption is unavailable.',
    keyPlaceholder: 'Enter a shared secret password…',
  },
] as const;

type CoffeeMarker = 'PP' | 'VK COFFEE' | 'II' | 'AP IDOG';

const COFFEE_MARKERS: ReadonlyArray<{ value: CoffeeMarker; label: string; client: string }> = [
  { value: 'PP',        label: 'PP',          client: 'Kate Mobile' },
  { value: 'VK COFFEE', label: 'VK CO FF EE', client: 'VK Coffee' },
  { value: 'II',        label: 'II',          client: 'Vika' },
  { value: 'AP IDOG',   label: 'AP IDOG',     client: 'Laney' },
];

function MessageCryptoPage(): React.ReactElement {
  const { t } = useTranslation('privacy');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const enabled      = settings['message_crypto'] === true;
  const format       = (settings['message_crypto_format'] as 'COFFEE' | 'VKify' | undefined) ?? 'VKify';
  const key          = (settings['message_crypto_key'] as string) ?? '';
  const coffeeMarker = (settings['message_crypto_coffee_marker'] as CoffeeMarker | undefined) ?? 'PP';

  const [showKey,   setShowKey]   = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const current  = CRYPTO_FORMATS.find(f => f.value === format) ?? CRYPTO_FORMATS[1];
  const isCoffee = format === 'COFFEE';
  const isActive = enabled && (isCoffee || !!key);

  const handleFormatChange = useCallback((v: 'COFFEE' | 'VKify'): void => {
    void saveSetting('message_crypto_format', v);
  }, [saveSetting]);

  const handleKeyChange = useCallback((v: string): void => {
    void saveSetting('message_crypto_key', v);
  }, [saveSetting]);

  const handleMarkerChange = useCallback((v: CoffeeMarker): void => {
    void saveSetting('message_crypto_coffee_marker', v);
  }, [saveSetting]);

  const copyKey = useCallback((): void => {
    void navigator.clipboard.writeText(key).then(() => {
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 1500);
    });
  }, [key]);

  return (
    <div className="space-y-5">
      {/* Master-тумблер */}
      <section className="rounded-2xl shadow-card overflow-hidden ring-1 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <SettingRow
          id="message_crypto"
          title={t('crypto.enable_title')}
          description={t('crypto.enable_desc')}
          icon={<LockIcon className="w-5 h-5" />}
          iconColor="green"
        />
      </section>

      {/* Зависимые настройки — гаснут, пока шифрование выключено */}
      <div
        aria-disabled={!enabled}
        className={`transition-opacity duration-200 ${enabled ? '' : 'opacity-40 pointer-events-none select-none grayscale'}`}
      >
        <SettingsSection title={t('crypto.format_section')}>
          <div className="px-4 pb-4 pt-1 space-y-3">

          {/* Статус */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isActive ? current.bg : 'bg-[var(--bg-secondary)]'}`}>
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isActive ? `bg-current ${current.color}` : 'bg-[var(--text-tertiary)]'}`} />
            <span className={`text-xs font-medium ${isActive ? current.color : 'text-[var(--text-tertiary)]'}`}>
              {isActive ? t('crypto.active', { emoji: current.emoji, label: current.label }) : t('crypto.enter_key')}
            </span>
          </div>

          {/* Выбор формата исходящих */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] pb-2">
              {t('crypto.outgoing_format')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CRYPTO_FORMATS.map(opt => {
                const active = format === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleFormatChange(opt.value)}
                    className={`flex flex-col items-start gap-1 p-3 rounded-xl border transition-all text-left ${
                      active
                        ? `${opt.ring} ${opt.bg} ${opt.color}`
                        : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <span className="text-base leading-none">{opt.emoji}</span>
                    <span className={`text-xs font-bold ${active ? opt.color : ''}`}>
                      {opt.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] leading-tight">{opt.algo}</span>
                    <span className="text-[9px] text-[var(--text-tertiary)] leading-tight opacity-80">{t(`crypto.formats.${opt.value}.compat`, { defaultValue: opt.compat })}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Маркер COFFEE (только для формата COFFEE) */}
          {isCoffee && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] pb-2">
                {t('crypto.outgoing_marker')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {COFFEE_MARKERS.map(m => {
                  const active = coffeeMarker === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => handleMarkerChange(m.value)}
                      className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl border transition-all text-left ${
                        active
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                          : 'border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      <span className={`text-xs font-bold font-mono ${active ? 'text-amber-500' : ''}`}>
                        {m.label}
                      </span>
                      <span className="text-[10px] text-[var(--text-tertiary)] leading-tight">
                        {m.client}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 leading-relaxed">
                {t('crypto.marker_note')}
              </p>
            </div>
          )}

          {/* Ключ / пароль */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] pb-1.5">
              {t(`crypto.formats.${current.value}.key_label`, { defaultValue: current.keyLabel })}
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={key}
                  onChange={e => handleKeyChange(e.target.value)}
                  placeholder={t(`crypto.formats.${current.value}.key_placeholder`, { defaultValue: current.keyPlaceholder })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[var(--border-color)]
                    bg-[var(--bg-secondary)] text-[var(--text-primary)]
                    focus:outline-none focus:border-primary/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]
                    hover:text-[var(--text-primary)] transition-colors text-[11px] px-1"
                >
                  {showKey ? t('crypto.hide') : t('crypto.show')}
                </button>
              </div>
              {key && (
                <button
                  type="button"
                  onClick={copyKey}
                  title={t('crypto.copy')}
                  className="px-2.5 py-2 rounded-xl border border-[var(--border-color)]
                    bg-[var(--bg-secondary)] text-[var(--text-tertiary)]
                    hover:text-primary hover:border-primary/30 transition-all text-xs"
                >
                  {keyCopied ? '✓' : '📋'}
                </button>
              )}
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5 leading-relaxed">
              {t(`crypto.formats.${current.value}.key_hint`, { defaultValue: current.keyHint })}
            </p>
          </div>

          {/* Подсказка */}
          <div className="p-2.5 bg-[var(--bg-secondary)] rounded-xl flex items-start gap-2">
            <InfoIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-[var(--text-secondary)]" />
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {t('crypto.tip', { emoji: current.emoji })}
            </p>
          </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
