import React, { useMemo } from 'react';

interface ActivityEntry {
  timestamp: number;
  online: boolean;
}

interface HourData {
  hour: number;
  label: string;
  key: string;
  onlineMinutes: number;
  isCurrentHour: boolean;
}

interface ActivityChartProps {
  activityData: ActivityEntry[];
  userName: string;
}

export default function ActivityChart({ activityData }: ActivityChartProps): React.ReactElement {
  const chartData = useMemo<HourData[]>(() => {
    const now = new Date();
    const hours: HourData[] = [];

    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourKey = `${time.getFullYear()}-${String(time.getMonth() + 1).padStart(2, '0')}-${String(time.getDate()).padStart(2, '0')}-${String(time.getHours()).padStart(2, '0')}`;

      hours.push({
        hour: time.getHours(),
        label: `${String(time.getHours()).padStart(2, '0')}:00`,
        key: hourKey,
        onlineMinutes: 0,
        isCurrentHour: i === 0,
      });
    }

    if (activityData && activityData.length > 0) {
      activityData.forEach(entry => {
        const entryDate = new Date(entry.timestamp);
        const hourKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}-${String(entryDate.getHours()).padStart(2, '0')}`;

        const hourData = hours.find(h => h.key === hourKey);
        if (hourData && entry.online) {
          hourData.onlineMinutes += 5;
        }
      });
    }

    return hours;
  }, [activityData]);

  const maxMinutes = Math.max(...chartData.map(h => h.onlineMinutes), 60);

  const stats = useMemo(() => {
    const totalOnlineMinutes = chartData.reduce((sum, h) => sum + h.onlineMinutes, 0);
    const hoursWithActivity = chartData.filter(h => h.onlineMinutes > 0).length;
    const onlinePercentage = Math.round((totalOnlineMinutes / (24 * 60)) * 100);

    return {
      totalOnlineMinutes,
      totalOnlineHours: Math.floor(totalOnlineMinutes / 60),
      totalOnlineMinutesRemainder: totalOnlineMinutes % 60,
      hoursWithActivity,
      onlinePercentage,
    };
  }, [chartData]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 bg-[var(--bg-secondary)] rounded-xl">
          <div className="text-xs text-[var(--text-tertiary)] mb-1">Онлайн</div>
          <div className="text-lg font-bold text-primary">
            {stats.totalOnlineHours}ч {stats.totalOnlineMinutesRemainder}м
          </div>
        </div>
        <div className="p-3 bg-[var(--bg-secondary)] rounded-xl">
          <div className="text-xs text-[var(--text-tertiary)] mb-1">Активность</div>
          <div className="text-lg font-bold text-success">{stats.onlinePercentage}%</div>
        </div>
        <div className="p-3 bg-[var(--bg-secondary)] rounded-xl">
          <div className="text-xs text-[var(--text-tertiary)] mb-1">Часов с активностью</div>
          <div className="text-lg font-bold text-[var(--text-primary)]">{stats.hoursWithActivity}/24</div>
        </div>
      </div>

      <div className="p-4 bg-[var(--bg-secondary)] rounded-xl">
        <div className="flex items-end justify-between gap-1 h-32">
          {chartData.map((hourData, index) => {
            const height = (hourData.onlineMinutes / maxMinutes) * 100;
            const isActive = hourData.onlineMinutes > 0;

            return (
              <div key={index} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full flex items-end justify-center" style={{ height: '100px' }}>
                  <div
                    className={`w-full rounded-t transition-all ${
                      isActive
                        ? hourData.isCurrentHour
                          ? 'bg-primary'
                          : 'bg-success'
                        : 'bg-[var(--bg-tertiary)]'
                    } ${isActive ? 'opacity-80 hover:opacity-100' : 'opacity-30'}`}
                    style={{ height: `${Math.max(height, isActive ? 8 : 4)}%` }}
                  />
                </div>

                {index % 4 === 0 && (
                  <div className="text-[9px] text-[var(--text-tertiary)] font-medium">
                    {hourData.hour}
                  </div>
                )}

                {isActive && (
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 shadow-lg whitespace-nowrap">
                      <div className="text-xs font-medium text-[var(--text-primary)]">{hourData.label}</div>
                      <div className="text-xs text-[var(--text-secondary)]">~{hourData.onlineMinutes} мин</div>
                    </div>
                    <div className="w-2 h-2 bg-[var(--bg-primary)] border-r border-b border-[var(--border-color)] transform rotate-45 -mt-1 ml-3" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-[var(--border-color)]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-success rounded" />
            <span className="text-xs text-[var(--text-secondary)]">Был онлайн</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-primary rounded" />
            <span className="text-xs text-[var(--text-secondary)]">Сейчас</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-[var(--bg-tertiary)] opacity-30 rounded" />
            <span className="text-xs text-[var(--text-secondary)]">Не в сети</span>
          </div>
        </div>
      </div>

      {activityData && activityData.length > 0 && (
        <div className="text-xs text-[var(--text-tertiary)] text-center">
          Данные основаны на {activityData.length} проверках за последние 24 часа
        </div>
      )}
    </div>
  );
}