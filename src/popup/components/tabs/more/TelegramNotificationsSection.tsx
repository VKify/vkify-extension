import { Input } from '@/popup/components/ui/FormControls.js';
import InfoDisclosure from '@/popup/components/ui/InfoDisclosure.js';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SpinnerIcon, TelegramIcon, MessengerIcon, EyeIcon, BellIcon, FriendsIcon, ActivityIcon, ProfileIcon, ChevronDownIcon } from '../../icons/Icons.js';
import SettingsSection from '../../ui/SettingsSection.js';
import SettingRow from '../../ui/SettingRow.js';
import { NestedField } from '../../ui/NestedSettings.js';
import './TelegramNotifications.css';
import ActionCard from '../../ui/ActionCard.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { getStorage, setStorage, subscribeStorage } from '@/popup/utils/storageClient.js';
import { sendMessage } from '@/shared/messaging.js';
import { isValidTelegramBotToken, isValidTelegramChatId, normalizeTelegramChatId } from '@/shared/telegram-notifications/types.js';
import TelegramQueue from './TelegramQueue.js';

export default function TelegramNotificationsSection(): React.ReactElement {
  const { t } = useTranslation('settings');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [testing, setTesting] = useState(false);
  const [relayStatus, setRelayStatus] = useState<{ status: string; checkedAt?: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () => { void getStorage<{ telegram_message_relay_status?: { status: string; checkedAt?: number } }>('telegram_message_relay_status').then(raw => {
      if (alive) setRelayStatus(raw.telegram_message_relay_status ?? null);
    }); };
    read();
    const unsubscribe = subscribeStorage(['telegram_message_relay_status'], read);
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => setToken(typeof settings.telegram_bot_token === 'string' ? settings.telegram_bot_token : ''), [settings.telegram_bot_token]);
  useEffect(() => setChatId(typeof settings.telegram_chat_id === 'string' ? settings.telegram_chat_id : ''), [settings.telegram_chat_id]);

  const enabled = settings.telegram_notifications_enabled === true;
  const tokenValid = !token || isValidTelegramBotToken(token);
  const chatIdValid = !chatId || isValidTelegramChatId(chatId);

  const saveCredentials = async (): Promise<boolean> => {
    if (!isValidTelegramBotToken(token) || !isValidTelegramChatId(chatId)) {
      showToast(t('more.telegram.validation_error'), 'error');
      return false;
    }
    const credentials = { telegram_bot_token: token.trim(), telegram_chat_id: normalizeTelegramChatId(chatId) };
    const saved = await saveMultiple(credentials);
    if (saved) await setStorage(credentials);
    return saved;
  };

  const saveField = (key: 'telegram_bot_token' | 'telegram_chat_id', value: string, valid: boolean): void => {
    if (!valid) {
      showToast(t('more.telegram.validation_error'), 'error');
      return;
    }
    void saveSetting(key, value.trim());
  };

  const sendTest = async (): Promise<void> => {
    if (!await saveCredentials()) return;
    setTesting(true);
    try {
      const result = await sendMessage({ type: 'TELEGRAM_TEST' });
      if (result.success && result.status === 'queued') {
        showToast(t('more.telegram.queue.accepted'), 'success');
        return;
      }
      showToast(
        result.success && result.status === 'sent'
          ? t('more.telegram.test_success')
          : t('more.telegram.test_error', { error: 'error' in result ? result.error : 'reason' in result ? result.reason : '' }),
        result.success && result.status === 'sent' ? 'success' : 'error',
      );
    } catch {
      showToast(t('more.telegram.test_error', { error: 'background unavailable' }), 'error');
    } finally {
      setTesting(false);
    }
  };


  return (
    <SettingsSection
      title={t('more.telegram.section')}
      description={t('more.telegram.description')}
      icon={<TelegramIcon className="w-5 h-5" />}
      className="telegram-section"
    >
      <SettingRow
        id="telegram_notifications_enabled"
        title={t('more.telegram.enabled')}
        description={t('more.telegram.enabled_desc')}
        icon={<TelegramIcon className="w-5 h-5" />}
      />
      <TelegramQueue />

      <div className="telegram-preferences" hidden={!enabled}>
      <details className="telegram-group telegram-settings-group">
        <summary><ActivityIcon /><span>{t('more.telegram.spy_options')}</span><ChevronDownIcon className="telegram-chevron" /></summary>
        <div className="settings-list">
        <SettingRow id="telegram_spy_activity_enabled" title={t('more.telegram.spy_activity')} icon={<ActivityIcon className="w-5 h-5" />} />
        <SettingRow id="telegram_spy_online_enabled" title={t('more.telegram.spy_online')} icon={<BellIcon className="w-5 h-5" />} />
        <SettingRow id="telegram_spy_profile_enabled" title={t('more.telegram.spy_profile')} icon={<ProfileIcon className="w-5 h-5" />} />
        </div>
      </details>
      <details className="telegram-group telegram-settings-group">
        <summary><MessengerIcon /><span>{t('more.telegram.messages_options')}</span><ChevronDownIcon className="telegram-chevron" /></summary>
        <SettingRow id="telegram_messages_enabled" title={t('more.telegram.messages_enabled')}
          description={t('more.telegram.messages_enabled_desc')} icon={<MessengerIcon className="w-5 h-5" />} />
        <div className="telegram-options settings-list" hidden={settings.telegram_messages_enabled !== true}>
          <SettingRow id="telegram_messages_preview" title={t('more.telegram.messages_preview')}
            description={t('more.telegram.messages_preview_desc')} icon={<EyeIcon className="w-5 h-5" />} />
          <SettingRow id="telegram_messages_chats" title={t('more.telegram.messages_chats')}
            description={t('more.telegram.messages_chats_desc')} icon={<FriendsIcon className="w-5 h-5" />} />
          <SettingRow id="telegram_messages_respect_muted" title={t('more.telegram.messages_muted')}
            description={t('more.telegram.messages_muted_desc')} icon={<BellIcon className="w-5 h-5" />} />
          <div className="telegram-note">
            <p>{t('more.telegram.messages_runtime_short')}</p>
            {relayStatus && <p className="mt-2" role="status">{t('more.telegram.messages_status.' + relayStatus.status)}{relayStatus.checkedAt ? ' · ' + new Date(relayStatus.checkedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : ''}</p>}
            <InfoDisclosure title={t('more.telegram.messages_how')}><p className="mt-2">{t('more.telegram.messages_runtime')}</p><p className="mt-2">{t('more.telegram.messages_baseline')}</p></InfoDisclosure>
          </div>
        </div>
      </details>
      <details className="telegram-group telegram-settings-group">
        <summary><TelegramIcon /><span>{t('more.telegram.connection')}</span><small>{t('more.telegram.' + (token && chatId && tokenValid && chatIdValid ? 'configured' : 'setup_needed'))}</small><ChevronDownIcon className="telegram-chevron" /></summary>
        <NestedField title={t('more.telegram.bot_token')} description={t('more.telegram.bot_token_desc')}>
          <Input
            type="password"
            autoComplete="off"
            aria-label={t('more.telegram.bot_token')}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onBlur={() => saveField('telegram_bot_token', token, tokenValid)}
            className="w-44" aria-invalid={!tokenValid}
            placeholder="123456789:AA…"
          />
        </NestedField>
        <NestedField title={t('more.telegram.chat_id')}>
          <Input
            type="text"
            aria-label={t('more.telegram.chat_id')}
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            onBlur={() => saveField('telegram_chat_id', normalizeTelegramChatId(chatId), chatIdValid)}
            className="w-44" aria-invalid={!chatIdValid}
            placeholder="123456789 / @username"
          />
        </NestedField>

        <div className="telegram-note"><InfoDisclosure title={t('more.telegram.connection_help')}><p>{t('more.telegram.chat_id_desc')}</p></InfoDisclosure></div>
        <NestedField title={t('more.telegram.dedupe')} description={t('more.telegram.dedupe_desc')}>
          <Input
            type="number"
            aria-label={t('more.telegram.dedupe')}
            min={1}
            max={86400}
            value={typeof settings.telegram_dedupe_ttl_seconds === 'number' ? settings.telegram_dedupe_ttl_seconds : 60}
            onChange={(event) => void saveSetting('telegram_dedupe_ttl_seconds', Math.min(86400, Math.max(1, Number(event.target.value) || 1)))}
            className="w-24"
          />
        </NestedField>

        <div className="px-4 pb-4">
          <ActionCard
            title={testing ? t('more.telegram.testing') : t('more.telegram.test')}
            description={t('more.telegram.test_desc')}
            icon={<TelegramIcon className="w-5 h-5" />}
            disabled={testing || !tokenValid || !chatIdValid || !token || !chatId}
            right={testing ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : undefined}
            onClick={() => void sendTest()}
          />
        </div>
      </details>
      </div>
    </SettingsSection>
  );
}
