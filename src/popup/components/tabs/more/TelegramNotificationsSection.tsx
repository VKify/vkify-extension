import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoIcon, SpinnerIcon, TelegramIcon } from '../../icons/Icons.js';
import SettingsSection from '../../ui/SettingsSection.js';
import SettingRow from '../../ui/SettingRow.js';
import NestedSettings, { NestedField } from '../../ui/NestedSettings.js';
import ActionCard from '../../ui/ActionCard.js';
import InfoBlock from '../../ui/InfoBlock.js';
import { useVKifyStore } from '@/popup/store/index.js';
import { useToast } from '@/popup/context/ToastContext.js';
import { setStorage } from '@/popup/utils/storageClient.js';
import { sendMessage } from '@/shared/messaging.js';
import { isValidTelegramBotToken, isValidTelegramChatId } from '@/shared/telegram-notifications/types.js';

export default function TelegramNotificationsSection(): React.ReactElement {
  const { t } = useTranslation('settings');
  const settings = useVKifyStore((s) => s.settings);
  const saveSetting = useVKifyStore((s) => s.saveSetting);
  const saveMultiple = useVKifyStore((s) => s.saveMultiple);
  const { showToast } = useToast();
  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [testing, setTesting] = useState(false);

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
    const credentials = { telegram_bot_token: token.trim(), telegram_chat_id: chatId.trim() };
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
      showToast(
        result.success && result.status === 'sent'
          ? t('more.telegram.test_success')
          : t('more.telegram.test_error', { error: 'error' in result ? result.error : result.reason }),
        result.success && result.status === 'sent' ? 'success' : 'error',
      );
    } catch {
      showToast(t('more.telegram.test_error', { error: 'background unavailable' }), 'error');
    } finally {
      setTesting(false);
    }
  };

  const inputClass = 'rounded-lg border bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-primary';

  return (
    <SettingsSection
      title={t('more.telegram.section')}
      description={t('more.telegram.description')}
      icon={<TelegramIcon className="w-5 h-5" />}
      iconColor="blue"
    >
      <SettingRow
        id="telegram_notifications_enabled"
        title={t('more.telegram.enabled')}
        description={t('more.telegram.enabled_desc')}
        icon={<TelegramIcon className="w-5 h-5" />}
      />

      <NestedSettings open={enabled} label={t('more.telegram.connection')}>
        <NestedField title={t('more.telegram.bot_token')} description={t('more.telegram.bot_token_desc')}>
          <input
            type="password"
            autoComplete="off"
            aria-label={t('more.telegram.bot_token')}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            onBlur={() => saveField('telegram_bot_token', token, tokenValid)}
            className={`${inputClass} w-44 ${tokenValid ? 'border-[var(--border-color)]' : 'border-red-500'}`}
            placeholder="123456789:AA…"
          />
        </NestedField>
        <NestedField title={t('more.telegram.chat_id')} description={t('more.telegram.chat_id_desc')}>
          <input
            type="text"
            aria-label={t('more.telegram.chat_id')}
            value={chatId}
            onChange={(event) => setChatId(event.target.value)}
            onBlur={() => saveField('telegram_chat_id', chatId, chatIdValid)}
            className={`${inputClass} w-44 ${chatIdValid ? 'border-[var(--border-color)]' : 'border-red-500'}`}
            placeholder="-1001234567890 / @channel"
          />
        </NestedField>
        <NestedField title={t('more.telegram.dedupe')} description={t('more.telegram.dedupe_desc')}>
          <input
            type="number"
            aria-label={t('more.telegram.dedupe')}
            min={1}
            max={86400}
            value={typeof settings.telegram_dedupe_ttl_seconds === 'number' ? settings.telegram_dedupe_ttl_seconds : 60}
            onChange={(event) => void saveSetting('telegram_dedupe_ttl_seconds', Math.min(86400, Math.max(1, Number(event.target.value) || 1)))}
            className={`${inputClass} w-24 border-[var(--border-color)]`}
          />
        </NestedField>

        <div className="mx-4 my-3">
          <InfoBlock icon={<InfoIcon className="w-4 h-4" />} title={t('more.telegram.routing_title')}>
            {t('more.telegram.routing_desc')}
          </InfoBlock>
        </div>

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
      </NestedSettings>
    </SettingsSection>
  );
}
