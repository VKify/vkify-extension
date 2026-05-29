import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal.js';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons/Icons.js';
import type { TrackedUser } from '../../../types/index.js';

interface ActivityEntry {
  timestamp: number;
  online: boolean;
}

interface HourStatus {
  status: 'online' | 'offline' | 'unknown';
  onlinePercent?: number;
  entries: ActivityEntry[];
}

interface ActivityComparisonModalProps {
  users: TrackedUser[];
  onClose: () => void;
}

const USER_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316',
];

export default function ActivityComparisonModal({ users, onClose }: ActivityComparisonModalProps): React.ReactElement {
  const [activityData, setActivityData] = useState<Record<string, ActivityEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedUsers, setSelectedUsers] = useState<string[]>(users.slice(0, 2).map(u => u.id));

  useEffect(() => {
    void loadAllActivity();
  }, [users]);

  const loadAllActivity = async (): Promise<void> => {
    setLoading(true);
    const data: Record<string, ActivityEntry[]> = {};

    for (const user of users) {
      try {
        const result = await chrome.storage.local.get([`activity_${user.id}`]);
        data[user.id] = (result[`activity_${user.id}`] as ActivityEntry[] | undefined) ?? [];
      } catch {
        data[user.id] = [];
      }
    }

    setActivityData(data);
    setLoading(false);
  };

  const toggleUser = (userId: string): void => {
    setSelectedUsers(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      if (prev.length >= 4) return [...prev.slice(1), userId];
      return [...prev, userId];
    });
  };

  const getUserColor = (userId: string): string => {
    const index = selectedUsers.indexOf(userId);
    return USER_COLORS[index % USER_COLORS.length] ?? USER_COLORS[0];
  };

  const timelineData = useMemo<Record<string, HourStatus[]>>(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const result: Record<string, HourStatus[]> = {};

    selectedUsers.forEach(userId => {
      const userData = activityData[userId] ?? [];
      const dayData = userData.filter(e =>
        e.timestamp >= dayStart.getTime() && e.timestamp < dayEnd.getTime()
      );

      const hourlyData: HourStatus[] = Array(24).fill(null).map((_, hour) => {
        const hourStart = dayStart.getTime() + hour * 60 * 60 * 1000;
        const hourEnd = hourStart + 60 * 60 * 1000;

        const hourEntries = dayData.filter(e => e.timestamp >= hourStart && e.timestamp < hourEnd);

        if (hourEntries.length === 0) return { status: 'unknown', entries: [] };

        const onlineCount = hourEntries.filter(e => e.online).length;
        const offlineCount = hourEntries.filter(e => !e.online).length;

        return {
          status: onlineCount > offlineCount ? 'online' : 'offline',
          onlinePercent: Math.round((onlineCount / hourEntries.length) * 100),
          entries: hourEntries,
        };
      });

      result[userId] = hourlyData;
    });

    return result;
  }, [activityData, selectedUsers, selectedDate]);

  const overlaps = useMemo<number[]>(() => {
    if (selectedUsers.length < 2) return [];

    const result: number[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const allOnline = selectedUsers.every(userId => timelineData[userId]?.[hour]?.status === 'online');
      if (allOnline) result.push(hour);
    }

    return result;
  }, [timelineData, selectedUsers]);

  const changeDate = (delta: number): void => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + delta);
    if (newDate <= new Date()) setSelectedDate(newDate);
  };

  const isToday = (date: Date): boolean =>
    date.toDateString() === new Date().toDateString();

  const formatHour = (hour: number): string =>
    `${hour.toString().padStart(2, '0')}:00`;

  return (
    <Modal
      title="Сравнение активности"
      ariaLabel="Сравнение активности"
      maxWidthClass="max-w-2xl"
      onClose={onClose}
      footer={
        <button
          onClick={onClose}
          className="w-full py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-xl transition-colors"
        >
          Закрыть
        </button>
      }
    >
      <p className="text-xs text-[var(--text-secondary)] px-4 pt-3">Выберите до 4 пользователей для сравнения</p>

      <div className="p-4 pb-2 border-b border-[var(--border-color)]">
          <div className="flex flex-wrap gap-2">
            {users.map((user) => {
              const isSelected = selectedUsers.includes(user.id);
              const color = isSelected ? getUserColor(user.id) : null;

              return (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected ? 'text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                  style={isSelected && color ? { backgroundColor: color } : {}}
                >
                  {user.photo ? (
                    <img src={user.photo} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
                      style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)' }}
                    >
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <span className="max-w-24 truncate">{user.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)]">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
            <ChevronLeftIcon className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>

          <div className="text-center">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              {selectedDate.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            {isToday(selectedDate) && <span className="text-xs text-primary">Сегодня</span>}
          </div>

          <button
            onClick={() => changeDate(1)}
            disabled={isToday(selectedDate)}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors disabled:opacity-30"
          >
            <ChevronRightIcon className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : selectedUsers.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-tertiary)]">
              Выберите пользователей для сравнения
            </div>
          ) : (
            <div className="space-y-4">
              {selectedUsers.length >= 2 && overlaps.length > 0 && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-xl">
                  <div className="text-sm font-medium text-success mb-1">
                    🎯 Совпадения онлайн: {overlaps.length} ч
                  </div>
                  <div className="text-xs text-success/80">
                    {overlaps.map(h => formatHour(h)).join(', ')}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-xs">
                {selectedUsers.map(userId => {
                  const user = users.find(u => u.id === userId);
                  return (
                    <div key={userId} className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded" style={{ backgroundColor: getUserColor(userId) }} />
                      <span className="text-[var(--text-secondary)]">{user?.name.split(' ')[0]}</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1.5 ml-auto">
                  <div className="w-3 h-3 rounded bg-[var(--bg-tertiary)]" />
                  <span className="text-[var(--text-tertiary)]">Нет данных</span>
                </div>
              </div>

              <div className="space-y-1">
                {Array(24).fill(null).map((_, hour) => {
                  const isOverlap = overlaps.includes(hour);

                  return (
                    <div
                      key={hour}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        isOverlap ? 'bg-success/5' : 'hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      <div className="w-12 text-xs font-mono text-[var(--text-tertiary)] flex-shrink-0">
                        {formatHour(hour)}
                      </div>

                      <div className="flex-1 flex gap-1">
                        {selectedUsers.map(userId => {
                          const hourData = timelineData[userId]?.[hour];
                          const isOnline = hourData?.status === 'online';
                          const hasData = hourData?.status !== 'unknown';

                          return (
                            <div
                              key={userId}
                              className="flex-1 h-6 rounded transition-all relative group"
                              style={{
                                backgroundColor: hasData
                                  ? isOnline
                                    ? getUserColor(userId)
                                    : `${getUserColor(userId)}20`
                                  : 'var(--bg-tertiary)',
                                opacity: hasData ? 1 : 0.3,
                              }}
                              title={`${users.find(u => u.id === userId)?.name}: ${
                                !hasData ? 'нет данных' : isOnline ? 'онлайн' : 'оффлайн'
                              }`}
                            >
                              {isOnline && hourData?.onlinePercent !== undefined && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                    {hourData.onlinePercent}%
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {isOverlap && (
                        <div className="w-6 flex-shrink-0 text-center">
                          <span className="text-success text-sm">✓</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--border-color)]">
                {selectedUsers.map(userId => {
                  const user = users.find(u => u.id === userId);
                  const userData = timelineData[userId] ?? [];
                  const onlineHours = userData.filter(h => h.status === 'online').length;
                  const dataHours = userData.filter(h => h.status !== 'unknown').length;

                  return (
                    <div
                      key={userId}
                      className="p-3 rounded-xl"
                      style={{ backgroundColor: `${getUserColor(userId)}10` }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {user?.photo ? (
                          <img src={user.photo} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                            style={{ backgroundColor: getUserColor(userId) }}
                          >
                            {user?.name.charAt(0)}
                          </div>
                        )}
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {user?.name.split(' ')[0]}
                        </span>
                      </div>
                      <div className="text-2xl font-bold" style={{ color: getUserColor(userId) }}>
                        {onlineHours} ч
                      </div>
                      <div className="text-xs text-[var(--text-tertiary)]">
                        онлайн за день{dataHours < 24 && ` (данных: ${dataHours} ч)`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
}