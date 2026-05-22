import React, { useMemo } from 'react';

interface ActivityEntry {
  timestamp: number;
  online: boolean;
}

interface WeeklyActivityChartProps {
  data: ActivityEntry[];
  height?: number;
}

interface DayData {
  date: Date;
  value: number;
  label: string;
}

function buildWeekData(data: ActivityEntry[]): DayData[] {
  const now = Date.now();
  const result: DayData[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = now - i * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dayData = data.filter(e => e.timestamp >= dayStart && e.timestamp < dayEnd);

    result.push({
      date: new Date(dayStart),
      value: dayData.filter(e => e.online).length,
      label: new Date(dayStart).toLocaleDateString('ru-RU', { weekday: 'short' }),
    });
  }

  return result;
}

export default function WeeklyActivityChart({ data, height = 60 }: WeeklyActivityChartProps) {
  const days = useMemo(() => buildWeekData(data), [data]);
  const maxValue = Math.max(...days.map(d => d.value), 1);

  return (
    <div className="flex items-end justify-between gap-1" style={{ height }}>
      {days.map((day, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary/20 rounded-t transition-all hover:bg-primary/30"
            style={{
              height: `${Math.max((day.value / maxValue) * 100, 5)}%`,
              minHeight: 4,
            }}
            title={`${day.label}: ${day.value} проверок онлайн`}
          >
            <div
              className="w-full h-full bg-primary rounded-t"
              style={{ opacity: day.value / maxValue }}
            />
          </div>
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase">
            {day.label.slice(0, 2)}
          </span>
        </div>
      ))}
    </div>
  );
}