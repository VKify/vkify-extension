import React, { useState, useCallback } from 'react';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import ActivityChart from '../charts/ActivityChart.js';
import Modal from '../ui/Modal.js';
import { XIcon, ClockIcon, EyeIcon, TrendingUpIcon } from '../icons/Icons.js';
import { useStorageReload } from '../../hooks/core/useStorageReload.js';
import { getStorage } from '@/popup/utils/storageClient.js';
import type { TrackedUser } from '@/types/index.js';

interface ActivityEntry {
  timestamp: number;
  online: boolean;
  platform?: number;
}

interface CurrentStatus {
  online: boolean;
  lastSeen: number;
  platform?: number;
}

interface PeriodDef {
  name: string;
  hours: number[];
  online: number;
  total: number;
}

interface PeakHour {
  period: string;
  percentage: number;
  description: string;
}

interface UserActivityModalProps {
  user: TrackedUser;
  onClose: () => void;
}

function getPeakHours(activityData: ActivityEntry[]): PeakHour[] {
  if (!activityData || activityData.length === 0) return [];

  const periods: Record<string, PeriodDef> = {
    morning: { name: i18n.t('modals:user_activity.morning'), hours: [6, 7, 8, 9, 10, 11], online: 0, total: 0 },
    afternoon: { name: i18n.t('modals:user_activity.afternoon'), hours: [12, 13, 14, 15, 16, 17], online: 0, total: 0 },
    evening: { name: i18n.t('modals:user_activity.evening'), hours: [18, 19, 20, 21, 22, 23], online: 0, total: 0 },
    night: { name: i18n.t('modals:user_activity.night'), hours: [0, 1, 2, 3, 4, 5], online: 0, total: 0 },
  };

  activityData.forEach(entry => {
    const hour = new Date(entry.timestamp).getHours();

    for (const period of Object.values(periods)) {
      if (period.hours.includes(hour)) {
        period.total++;
        if (entry.online) period.online++;
        break;
      }
    }
  });

  return Object.values(periods)
    .map(period => ({
      period: period.name,
      percentage: period.total > 0 ? Math.round((period.online / period.total) * 100) : 0,
      description: `${period.hours[0]}:00 - ${period.hours[period.hours.length - 1]}:59`,
    }))
    .filter(p => p.percentage > 0)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3);
}

export default function UserActivityModal({ user, onClose }: UserActivityModalProps): React.ReactElement {
  const { t } = useTranslation('modals');
  const [activityData, setActivityData] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState<CurrentStatus | null>(null);

  const loadActivityData = useCallback(async (): Promise<void> => {
    try {
      const result = await getStorage([`activity_${user.id}`]);
      const data = (result[`activity_${user.id}`] as ActivityEntry[] | undefined) ?? [];

      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const filtered = data.filter(entry => entry.timestamp > dayAgo);

      setActivityData(filtered);

      if (filtered.length > 0) {
        const latest = filtered[filtered.length - 1];
        setCurrentStatus({
          online: latest.online,
          lastSeen: latest.timestamp,
          platform: latest.platform,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('[VKify] Error loading activity data:', error);
      setLoading(false);
    }
  }, [user.id]);

  useStorageReload([`activity_${user.id}`], loadActivityData);

  const weekStats = React.useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekData = activityData.filter(entry => entry.timestamp > weekAgo);

    const dayGroups: Record<string, { online: number; total: number }> = {};
    weekData.forEach(entry => {
      const date = new Date(entry.timestamp);
      const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!dayGroups[dayKey]) {
        dayGroups[dayKey] = { online: 0, total: 0 };
      }

      dayGroups[dayKey].total++;
      if (entry.online) dayGroups[dayKey].online++;
    });

    const days = Object.values(dayGroups);
    const avgOnlinePercentage = days.length > 0
      ? Math.round(days.reduce((sum, day) => sum + (day.online / day.total * 100), 0) / days.length)
      : 0;

    return { avgOnlinePercentage, daysTracked: days.length };
  }, [activityData]);

  const formatLastSeen = (timestamp: number | undefined): string => {
    if (!timestamp) return t('last_seen.unknown');

    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return t('last_seen.just_now');
    if (diff < 3600000) return t('last_seen.min_ago', { count: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('last_seen.hour_ago', { count: Math.floor(diff / 3600000) });

    return new Date(timestamp).toLocaleString(i18n.language, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  };

  const getPlatformName = (platform: number | undefined): string =>
    platform !== undefined
      ? t(`platform.${platform}`, { defaultValue: t('platform.unknown') })
      : t('platform.unknown');

  return (
    <Modal
      showHeader={false}
      ariaLabel={user.name}
      maxWidthClass="max-w-2xl"
      onClose={onClose}
      footer={
        <button
          onClick={onClose}
          className="w-full py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
        >
          {t('close')}
        </button>
      }
    >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] sticky top-0 bg-[var(--bg-primary)] z-10">
          <div className="flex items-center gap-3">
            {user.photo ? (
              <img src={user.photo} alt={user.name} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-medium text-primary">{user.name.charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{user.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {currentStatus?.online ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <span className="w-2 h-2 bg-success rounded-full" />
                    {t('user_activity.online')}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--text-tertiary)]">
                    <ClockIcon className="w-3 h-3 inline mr-1" />
                    {formatLastSeen(currentStatus?.lastSeen)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activityData.length === 0 ? (
            <div className="text-center py-12">
              <EyeIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-tertiary)]">{t('user_activity.no_data')}</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">{t('user_activity.no_data_hint')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {currentStatus && (
                <div className="p-4 bg-[var(--bg-secondary)] rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)] mb-1">{t('user_activity.current_status')}</div>
                      <div className="flex items-center gap-2">
                        {currentStatus.online ? (
                          <>
                            <span className="w-3 h-3 bg-success rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-success">{t('user_activity.online2')}</span>
                          </>
                        ) : (
                          <>
                            <span className="w-3 h-3 bg-[var(--text-tertiary)] rounded-full" />
                            <span className="text-sm font-medium text-[var(--text-secondary)]">{t('user_activity.offline')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {currentStatus.platform !== undefined && (
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-tertiary)] mb-1">{t('user_activity.platform_label')}</div>
                        <div className="text-sm text-[var(--text-secondary)]">{getPlatformName(currentStatus.platform)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {weekStats.daysTracked > 0 && (
                <div className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUpIcon className="w-5 h-5 text-primary" />
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{t('user_activity.week_stats')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)] mb-1">{t('user_activity.avg_activity')}</div>
                      <div className="text-2xl font-bold text-primary">{weekStats.avgOnlinePercentage}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-tertiary)] mb-1">{t('user_activity.days_tracked')}</div>
                      <div className="text-2xl font-bold text-[var(--text-primary)]">{weekStats.daysTracked}</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{t('user_activity.chart_24h')}</h4>
                <ActivityChart activityData={activityData} userName={user.name} />
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">{t('user_activity.patterns')}</h4>
                <div className="space-y-2">
                  {getPeakHours(activityData).map((peak, index) => (
                    <div
                      key={index}
                      className="p-3 bg-[var(--bg-secondary)] rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ClockIcon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)]">{peak.period}</div>
                          <div className="text-xs text-[var(--text-tertiary)]">{peak.description}</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-primary">{peak.percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
}