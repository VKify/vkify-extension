import React, { useState, useEffect, useMemo } from 'react';
import { XIcon } from '../icons/Icons.js';
import { activityKey } from '../../../shared/constants/storage-keys.js';
import type { TrackedUser } from '../../../types/index.js';

interface ActivityEntry {
  timestamp: number;
  online: boolean;
}

interface ChartDay {
  value: number;
  label: string;
}

interface OverallActivityModalProps {
  users: TrackedUser[];
  onClose: () => void;
}

export default function OverallActivityModal({ users, onClose }: OverallActivityModalProps) {
  const [activityData, setActivityData] = useState<Record<string, ActivityEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoading(true);
      const data: Record<string, ActivityEntry[]> = {};

      for (const user of users) {
        try {
          const result = await chrome.storage.local.get([activityKey(user.id)]);
          data[user.id] = (result[activityKey(user.id)] as ActivityEntry[] | undefined) ?? [];
        } catch {
          data[user.id] = [];
        }
      }

      setActivityData(data);
      setLoading(false);
    };

    void load();
  }, [users]);

  const chartData = useMemo((): ChartDay[] => {
    const now = Date.now();
    const days = period === 'week' ? 7 : 30;
    const result: ChartDay[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const dayStart = now - i * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;

      let onlineUsers = 0;
      users.forEach(user => {
        const userData = activityData[user.id] ?? [];
        const hasOnline = userData.some(
          e => e.timestamp >= dayStart && e.timestamp < dayEnd && e.online,
        );
        if (hasOnline) onlineUsers++;
      });

      result.push({
        value: onlineUsers,
        label: new Date(dayStart).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
      });
    }

    return result;
  }, [activityData, users, period]);

  const maxValue = Math.max(...chartData.map(d => d.value), 1);
  const totalChecks = chartData.reduce((a, b) => a + b.value, 0);
  const avgPerDay = totalChecks > 0
    ? Math.round((totalChecks / chartData.length) * 10) / 10
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-lg shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">Общий график активности</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Сколько пользователей было онлайн каждый день
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-2 p-4 pb-2">
          {(['week', 'month'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 text-sm font-medium rounded-xl transition-colors ${
                period === p
                  ? 'bg-primary text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              {p === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4">
              <div className="flex items-end justify-between gap-1 h-40 mb-2">
                {chartData.map((day, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center"
                    title={`${day.label}: ${day.value} из ${users.length} онлайн`}
                  >
                    <div
                      className="w-full bg-primary rounded-t transition-all hover:opacity-80 cursor-pointer"
                      style={{
                        height: `${Math.max((day.value / maxValue) * 100, 3)}%`,
                        minHeight: 4,
                        opacity: 0.3 + (day.value / maxValue) * 0.7,
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
                <span>{chartData[0]?.label}</span>
                <span>{chartData[Math.floor(chartData.length / 2)]?.label}</span>
                <span>{chartData[chartData.length - 1]?.label}</span>
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--border-color)]">
                <div className="text-center">
                  <div className="text-xl font-bold text-primary">{users.length}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">Всего</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-success">
                    {Math.max(...chartData.map(d => d.value))}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">Макс/день</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-[var(--text-primary)]">{avgPerDay}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">Среднее</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border-color)]">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}