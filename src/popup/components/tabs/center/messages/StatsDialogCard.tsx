import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, ExternalLinkIcon } from '@/popup/components/icons/Icons.js';
import { dialogUrl, type StatsRow } from './statsView.js';

interface Props {
  row: StatsRow;
  rank: number;
  maxCount: number;
  selected: boolean;
  disabled: boolean;
  compact: boolean;
  toggle: () => void;
}
export default function StatsDialogCard({ row, rank, maxCount, selected, disabled, compact, toggle }: Props) {
  const { t, i18n } = useTranslation('center');
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const number = (value: number) => value.toLocaleString(i18n.resolvedLanguage);
  const count = row.approxMessageCount === null ? '—' : `${row.countExact ? '' : '≈ '}${number(row.approxMessageCount)}`;
  return <li className={`ds-dialog ${selected ? 'is-selected' : ''} ${compact ? 'is-compact' : ''}`}>
    <div className="ds-dialog-head">
      <input type="checkbox" checked={selected} disabled={disabled} onChange={toggle}
        aria-label={t('stats.select_dialog', { title: row.title })} />
      <a href={dialogUrl(row)} target="_blank" rel="noopener noreferrer" className="ds-identity">
        <span className="ds-avatar" aria-hidden="true">
          {row.avatar && !brokenAvatar ? <img src={row.avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBrokenAvatar(true)} />
            : row.title.slice(0, 1).toLocaleUpperCase()}
        </span>
        <span className="ds-name"><strong>{row.title}</strong><small>{t(`stats.types.${row.type}`)} <span aria-hidden="true">·</span> #{rank}</small></span>
        <ExternalLinkIcon className="ds-open-icon" />
      </a>
      <div className="ds-count" title={t(row.countExact ? 'stats.count_exact' : 'stats.count_estimated')}>
        <strong>{count}</strong><small>{row.countExact && <CheckCircleIcon className="ds-mini-icon" />}{t('stats.messages')}</small>
      </div>
    </div>
    {!compact && <div className="ds-volume" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, (row.approxMessageCount ?? 0) / Math.max(1, maxCount) * 100))}%` }} /></div>}
    <div className="ds-dialog-meta">
      <span className={`ds-badge ${row.isDead ? 'ds-badge-warm' : row.lastMessageAt === null ? '' : 'ds-badge-green'}`}>
        <span className="ds-dot" />{t(row.isDead ? 'stats.dead' : row.lastMessageAt === null ? 'stats.unknown' : 'stats.active')}
      </span>
      <span className="ds-age">{row.daysSinceLast === null ? t('stats.unknown') : row.daysSinceLast === 0 ? t('stats.today') : t('stats.days_ago', { count: row.daysSinceLast })}</span>
      {row.unread > 0 && <span className="ds-unread">{t('stats.unread_count', { count: row.unread })}</span>}
    </div>
    {!compact && <div className="ds-dialog-foot">
      <span>{t('stats.author')}: <b>{t(`stats.direction.${row.lastDirection}`)}</b></span>
      {row.lastMessageAt !== null && <time dateTime={new Date(row.lastMessageAt).toISOString()} title={new Date(row.lastMessageAt).toLocaleString(i18n.resolvedLanguage)}>
        {new Date(row.lastMessageAt).toLocaleDateString(i18n.resolvedLanguage, { day: 'numeric', month: 'short', year: 'numeric' })}
      </time>}
    </div>}
  </li>;
}
