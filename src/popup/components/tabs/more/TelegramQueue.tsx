import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getStorage, subscribeStorage } from '@/popup/utils/storageClient.js';
import { sendMessage } from '@/shared/messaging.js';
import { TELEGRAM_QUEUE_KEY, queueItemStatus, type TelegramQueueState } from '@/shared/telegram-notifications/queue.js';
import { readTelegramSettings } from '@/shared/telegram-notifications/settings.js';
import { useVKifyStore } from '@/popup/store/index.js';
import InfoDisclosure from '@/popup/components/ui/InfoDisclosure.js';
import { ChevronDownIcon } from '../../icons/Icons.js';

export default function TelegramQueue(): React.ReactElement {
  const { t } = useTranslation('settings');
  const raw = useVKifyStore(s => s.settings);
  const settings = readTelegramSettings(raw);
  const [queue, setQueue] = useState<TelegramQueueState>();
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const read = () => { void getStorage<Record<string, TelegramQueueState>>(TELEGRAM_QUEUE_KEY).then(data => {
      if (alive) setQueue(data[TELEGRAM_QUEUE_KEY]);
    }).catch(() => { if (alive) setError(true); }); };
    read();
    const unsubscribe = subscribeStorage([TELEGRAM_QUEUE_KEY], read);
    return () => { alive = false; unsubscribe(); };
  }, []);
  const items = queue?.items ?? [];
  const delivered = queue?.delivered ?? 0;
  const completed = queue?.batchDelivered ?? delivered;
  const total = queue?.batchTotal ?? completed + items.length;
  const retry = async () => {
    setRetrying(true); setError(false);
    try { const result = await sendMessage({ type: 'TELEGRAM_QUEUE_RETRY' }); setError(!result.success); }
    catch { setError(true); }
    finally { setRetrying(false); }
  };
  return <div className="telegram-group telegram-queue" aria-label={t('more.telegram.queue.title')}>
    <div className="telegram-note">
      <div className="telegram-queue-header"><b>{t('more.telegram.queue.title')}</b><span className="telegram-queue-counts" aria-live="polite">
        <span>{t('more.telegram.queue.waiting')}: <b>{items.length}</b></span>
        <span>{t('more.telegram.queue.sent')}: <b>{delivered}</b></span>
        {items.some(i => i.error) && <span>{t('more.telegram.queue.attention')}: <b>{items.filter(i => i.error).length}</b></span>}
      </span></div>
      {!!items.length && <progress max={Math.max(total, 1)} value={completed} aria-label={t('more.telegram.queue.progress')} />}
      <p role="status">{t('more.telegram.queue.' + (!items.length ? 'empty' : items.every(i => ['paused', 'other_recipient'].includes(queueItemStatus(i, settings))) ? 'paused' : items.some(i => i.status === 'sending') ? 'sending' : 'waiting'))}</p>
      {items.length > 0 && <button type="button" className="telegram-queue-retry" disabled={retrying} onClick={() => void retry()}>{t('more.telegram.queue.retry_now')}</button>}
      {error && <p role="alert">{t('more.telegram.queue.unavailable')}</p>}
      {!!items.length && <details className="telegram-queue-details"><summary>{t('more.telegram.queue.details')}<ChevronDownIcon /></summary>
      <ul className="telegram-queue-items">
        {items.slice(0, 20).map(item => <li key={item.id}>
          <div><b>{item.payload.title}</b><span>{t('more.telegram.queue.' + queueItemStatus(item, settings))}</span></div>
          <small>{t('more.telegram.queue.attempts', { count: item.attempts })} · {new Date(item.createdAt).toLocaleTimeString()}</small>
          {item.attempts > 0 && item.status !== 'sending' && <small>{t('more.telegram.queue.next_attempt')}: {new Date(item.nextAttemptAt).toLocaleTimeString()}</small>}
          {item.error && <p className="telegram-queue-error">{item.error}</p>}
        </li>)}
      </ul>
      {items.length > 20 && <p>{t('more.telegram.queue.more', { count: items.length - 20 })}</p>}
      </details>}
      {!!queue?.recent.length && <details><summary>{t('more.telegram.queue.recent')}</summary><ul className="telegram-queue-items">{queue.recent.map(item => <li key={item.id}><b>{item.title}</b> · {new Date(item.sentAt).toLocaleTimeString()}{item.messageId ? ` · #${item.messageId}` : ''}</li>)}</ul></details>}
      <InfoDisclosure title={t('more.telegram.queue.help')}><p>{t('more.telegram.queue.description')}</p></InfoDisclosure>
    </div>
  </div>;
}
