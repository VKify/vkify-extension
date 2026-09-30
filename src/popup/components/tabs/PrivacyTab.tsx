import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SubpageHost, { type Subpage, useSubpageNav } from '../ui/SubpageHost.js';
import {
  DashboardHero, DashboardHeroImage, DashboardNavItem, DashboardPanel, DashboardSettingCard, SegmentedControl,
} from '../ui/DashboardPrimitives.js';
import AddUserModal from '../modals/AddUserModal.js';
import HotkeyPicker from '../ui/HotkeyPicker.js';
import Toggle from '../ui/Toggle.js';
import NestedSettings from '../ui/NestedSettings.js';
import {
  BellIcon, BlurIcon, CheckIcon, CopyIcon, EditIcon, EyeOffIcon, InfoIcon, KeyboardIcon,
  LockIcon, MessageCircleIcon, MessageIcon, PlusIcon, ShieldIcon, WarningIcon, XIcon,
} from '../icons/Icons.js';
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

interface PrivacySetting {
  id: string;
  icon: React.ReactNode;
}

const PRIVACY: PrivacySetting[] = [
  {
    id: 'prevent_typing',
    icon: <EditIcon className="w-5 h-5" />,
  },
  {
    id: 'prevent_read',
    icon: <CheckIcon className="w-5 h-5" />,
  },
  {
    id: 'prevent_story_views',
    icon: <EyeOffIcon className="w-5 h-5" />,
  },
  {
    id: 'prevent_notification_read',
    icon: <BellIcon className="w-5 h-5" />,
  },
  {
    id: 'blur_on_unfocus',
    icon: <BlurIcon className="w-5 h-5" />,
  },
];

interface HiddenDialogCardProps {
  dialog: HiddenDialog;
  onRemove: (id: string) => void;
}

function HiddenDialogCard({ dialog, onRemove }: HiddenDialogCardProps) {
  const { t } = useTranslation('privacy');
  return (
    <DashboardSettingCard
      icon={dialog.photo
        ? <img src={dialog.photo} alt="" className="h-9 w-9 rounded-lg object-cover" />
        : <span className="text-sm font-semibold">{dialog.name.charAt(0).toUpperCase()}</span>}
      title={dialog.name}
      description={`ID: ${dialog.id}`}
      control={<button type="button" aria-label={`${dialog.name}: ${t('hidden.remove')}`} onClick={() => onRemove(dialog.id)}
        className="rounded-lg p-2 text-[var(--text-tertiary)] transition-colors hover:bg-error/10 hover:text-error">
        <XIcon className="h-4 w-4" />
      </button>}
    />
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

  const addButton = <button type="button" onClick={() => setShowModal(true)}
    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
    <PlusIcon className="h-3.5 w-3.5" />{t('hidden.add')}
  </button>;

  return (
    <div {...(asPage ? {} : { 'data-vkify-anchor': 'hidden_dialogs' })}>
      <DashboardPanel title={t('hidden.list_label', { count: hiddenDialogs.length })} description={t('hidden.intro')}
        icon={<MessageCircleIcon className="h-5 w-5" />} action={addButton} className="pb-4">
      <div className="px-4 pt-1">
        {hiddenDialogs.length > 0 ? (
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {hiddenDialogs.map(dialog => (
              <HiddenDialogCard key={dialog.id} dialog={dialog} onRemove={removeDialog} />
            ))}
          </div>
        ) : (
          <DashboardSettingCard icon={<EyeOffIcon className="h-5 w-5" />} title={t('hidden.empty')} description={t('hidden.empty_hint')} />
        )}
      </div>
      </DashboardPanel>

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
    </div>
  );
}


export default function PrivacyTab(): React.ReactElement {
  const { t } = useTranslation('privacy');
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
      <PrivacyOverview />
    </SubpageHost>
  );
}

function PrivacyArtwork(): React.ReactElement {
  return <DashboardHeroImage src="/assets/dashboard/privacy-hero.png" />;
}

function PrivacyToggleCard({ id, title, description, icon }: { id: string; title: string; description: string; icon: React.ReactNode }): React.ReactElement {
  const checked = useVKifyStore(state => state.settings[id] === true);
  const saveSetting = useVKifyStore(state => state.saveSetting);
  return <DashboardSettingCard icon={icon} title={title} description={description} tone="primary"
    control={<Toggle checked={checked} onChange={value => { void saveSetting(id, value); }} />} />;
}

function PrivacyOverview(): React.ReactElement {
  const { t } = useTranslation('privacy');
  const { open } = useSubpageNav();
  const settings = useVKifyStore(state => state.settings);
  const saveSetting = useVKifyStore(state => state.saveSetting);
  const hideDialogsHotkey = (settings['hide_dialogs_hotkey_combo'] as HotkeyCombo | undefined) ?? DEFAULT_HIDE_DIALOGS_HOTKEY;
  const cryptoEnabled = settings['message_crypto'] === true;
  const cryptoFormat = (settings['message_crypto_format'] as 'COFFEE' | 'VKify' | undefined) ?? 'VKify';
  const hiddenCount = ((settings['hidden_dialogs'] as unknown[] | undefined) ?? []).length;
  const panicEnabled = settings['hide_dialogs_hotkey'] === true;

  return <div className="space-y-4 pb-4">
    <DashboardHero title={t('section')} subtitle={t('hero_subtitle')} description={t('hero_description')} artwork={<PrivacyArtwork />} />

    <DashboardPanel title={t('controls_title')} description={t('controls_description')}
      icon={<ShieldIcon className="h-5 w-5" />} className="pb-4">
      <div className="grid grid-cols-2 gap-2 px-4 pt-1 max-[590px]:grid-cols-1">
        <OnlineStatusControl />
        {PRIVACY.map(item => <PrivacyToggleCard key={item.id} id={item.id} icon={item.icon}
          title={t(`items.${item.id}.title`)} description={t(`items.${item.id}.desc`)} />)}
        <PrivacyToggleCard id="hide_dialogs_hotkey" icon={<EyeOffIcon className="h-5 w-5" />}
          title={t('panic.title')} description={t('panic.desc')} />
        <NestedSettings open={panicEnabled} className="col-span-full !mx-0">
          <DashboardSettingCard icon={<KeyboardIcon className="h-5 w-5" />} title={t('hotkey')}
            control={<HotkeyPicker value={hideDialogsHotkey} defaultValue={DEFAULT_HIDE_DIALOGS_HOTKEY}
              onChange={combo => { void saveSetting('hide_dialogs_hotkey_combo', combo); }} />} />
        </NestedSettings>
      </div>
    </DashboardPanel>

    <DashboardPanel title={t('tools_title')} description={t('tools_description')}
      icon={<LockIcon className="h-5 w-5" />} className="pb-4">
      <div className="grid grid-cols-2 gap-2 px-4 pt-1 max-[590px]:grid-cols-1">
        <DashboardNavItem title={t('crypto.title')} description={t('crypto.subtitle')} icon={<LockIcon className="h-5 w-5" />}
          docsId="message_crypto" onClick={() => open('crypto')}
          meta={cryptoEnabled ? (cryptoFormat === 'COFFEE' ? 'COFFEE' : 'VKify E2E') : t('off')} />
        <DashboardNavItem title={t('hidden.title')} description={t('hidden.subtitle')} icon={<MessageCircleIcon className="h-5 w-5" />}
          docsId="hidden_dialogs" onClick={() => open('hidden')}
          meta={hiddenCount > 0 ? t('hidden_count', { count: hiddenCount }) : undefined} />
      </div>
    </DashboardPanel>

    <DashboardSettingCard icon={<WarningIcon className="h-5 w-5" />} title={t('warn_title')} description={t('warn_body')} />
  </div>;
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

  return <div data-vkify-anchor="hide_online">
    <DashboardSettingCard icon={<EyeOffIcon className="h-5 w-5" />} title={t('online.title')}
      description={t('online.desc')} tone="primary"
      control={<Toggle checked={hidden === true} onChange={value => { void handleToggle(value); }} disabled={loading || busy} />} />
  </div>;
}

// ── Шифрование сообщений (внутри секции "Приватность") ────────────────────

const CRYPTO_FORMATS = [
  {
    value: 'COFFEE' as const,
    icon: <MessageIcon className="h-4 w-4" />,
    label: 'COFFEE',
    algo: 'AES-128-ECB',
    compat: 'Kate Mobile · VK Coffee · Laney · Vika',
    keyLabel: 'Key (optional)',
    keyHint: "Without a key, the protocol's public key is used, compatible with Kate Mobile and VK Coffee by default.",
    keyPlaceholder: 'Leave empty for compatibility with Kate Mobile / VK Coffee…',
  },
  {
    value: 'VKify' as const,
    icon: <LockIcon className="h-4 w-4" />,
    label: 'VKify E2E',
    algo: 'AES-256-GCM',
    compat: 'VKify ↔ VKify only',
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
    <div className="space-y-4">
      <DashboardPanel title={t('crypto.master_section')} description={t('crypto.enable_desc')}
        icon={<LockIcon className="h-5 w-5" />} className="pb-4">
        <div className="px-4 pt-1">
          <div data-vkify-anchor="message_crypto">
            <DashboardSettingCard icon={<LockIcon className="h-5 w-5" />} title={t('crypto.enable_title')}
              description={t('crypto.enable_desc')} tone="primary"
              control={<Toggle checked={enabled} onChange={value => { void saveSetting('message_crypto', value); }} />} />
          </div>
        </div>
      </DashboardPanel>

      <div aria-disabled={!enabled} className={`transition-opacity duration-200 ${enabled ? '' : 'pointer-events-none select-none opacity-60'}`}>
        <DashboardPanel title={t('crypto.format_section')} description={t('crypto.subtitle')}
          icon={<MessageIcon className="h-5 w-5" />} className="pb-4">
          <div className="space-y-3 px-4 pt-1">
            <DashboardSettingCard icon={current.icon}
              title={isActive ? t('crypto.active', { label: current.label }) : t('crypto.enter_key')}
              description={`${current.algo} · ${t(`crypto.formats.${current.value}.compat`, { defaultValue: current.compat })}`}
              tone={isActive ? 'primary' : 'neutral'} />

            <div>
              <p className="pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{t('crypto.outgoing_format')}</p>
              <SegmentedControl label={t('crypto.outgoing_format')} value={format}
                options={CRYPTO_FORMATS.map(option => ({ value: option.value, label: option.label, icon: option.icon }))}
                onChange={handleFormatChange} />
            </div>

            {isCoffee && <div>
              <p className="pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{t('crypto.outgoing_marker')}</p>
              <SegmentedControl label={t('crypto.outgoing_marker')} value={coffeeMarker}
                options={COFFEE_MARKERS.map(marker => ({ value: marker.value, label: marker.label }))}
                onChange={handleMarkerChange} />
              <p className="mt-1.5 text-[10px] leading-relaxed text-[var(--text-tertiary)]">{t('crypto.marker_note')}</p>
            </div>}

            <DashboardSettingCard icon={<KeyboardIcon className="h-5 w-5" />} tone="primary">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t(`crypto.formats.${current.value}.key_label`, { defaultValue: current.keyLabel })}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={showKey ? 'text' : 'password'} value={key} onChange={event => handleKeyChange(event.target.value)}
                    placeholder={t(`crypto.formats.${current.value}.key_placeholder`, { defaultValue: current.keyPlaceholder })}
                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 pr-16 text-xs text-[var(--text-primary)] transition-colors focus:border-primary/50 focus:outline-none" />
                  <button type="button" onClick={() => setShowKey(value => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-[11px] text-[var(--text-tertiary)] transition-colors hover:text-[var(--text-primary)]">
                    {showKey ? t('crypto.hide') : t('crypto.show')}
                  </button>
                </div>
                {key && <button type="button" onClick={copyKey} title={t('crypto.copy')}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-2 text-[var(--text-tertiary)] transition-colors hover:border-primary/30 hover:text-primary">
                  {keyCopied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                </button>}
              </div>
              <p className="text-[10px] leading-relaxed text-[var(--text-tertiary)]">
                {t(`crypto.formats.${current.value}.key_hint`, { defaultValue: current.keyHint })}
              </p>
            </DashboardSettingCard>

            <DashboardSettingCard icon={<InfoIcon className="h-5 w-5" />} title={t('crypto.tip_title')}
              description={t('crypto.tip')} />
          </div>
        </DashboardPanel>
      </div>
    </div>
  );
}
