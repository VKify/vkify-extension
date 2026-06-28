import React from 'react';

interface RangeSliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  zeroLabel?: string;
  onChange: (value: number) => void;
  /**
   * Компактная раскладка для строк настроек: текущее значение синим стоит
   * рядом с заголовком, а метки краёв шкалы (`minLabel`/`maxLabel`) обрамляют
   * сам слайдер в одну строку — без дублирующего текста под ним.
   */
  inline?: boolean;
  /** Подсказка под заголовком (только в `inline`-раскладке). */
  description?: string;
  /** Метка левого края шкалы. По умолчанию — `zeroLabel`/`min`. */
  minLabel?: string;
  /** Метка правого края шкалы. По умолчанию — `max + unit`. */
  maxLabel?: string;
  /** Необязательная иконка перед заголовком (вместо эмодзи в тексте label). */
  icon?: React.ReactNode;
}

export default function RangeSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  unit = '',
  zeroLabel = '0',
  onChange,
  inline = false,
  description,
  minLabel,
  maxLabel,
  icon,
}: RangeSliderProps) {
  const displayValue = value === 0 && zeroLabel ? zeroLabel : `${value}${unit}`;
  const percentage = ((value - min) / (max - min)) * 100;

  const sliderInput = (
    <input
      type="range"
      id={id}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="w-full h-2 rounded-full appearance-none cursor-pointer
        [&::-webkit-slider-thumb]:appearance-none
        [&::-webkit-slider-thumb]:w-5
        [&::-webkit-slider-thumb]:h-5
        [&::-webkit-slider-thumb]:bg-primary
        [&::-webkit-slider-thumb]:rounded-full
        [&::-webkit-slider-thumb]:cursor-pointer
        [&::-webkit-slider-thumb]:shadow-md
        [&::-webkit-slider-thumb]:shadow-primary/30
        [&::-webkit-slider-thumb]:hover:scale-110
        [&::-webkit-slider-thumb]:active:scale-95
        [&::-moz-range-thumb]:w-5
        [&::-moz-range-thumb]:h-5
        [&::-moz-range-thumb]:bg-primary
        [&::-moz-range-thumb]:rounded-full
        [&::-moz-range-thumb]:border-none
      "
      style={{
        background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${percentage}%, var(--bg-tertiary) ${percentage}%, var(--bg-tertiary) 100%)`,
      }}
    />
  );

  if (inline) {
    return (
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5">
            {icon}{label}
          </label>
          <span className="text-xs font-medium" style={{ color: '#5b9cf6' }}>
            {`${value}${unit}`}
          </span>
        </div>

        {description && (
          <p className="text-[10px] text-[var(--text-tertiary)] -mt-1">{description}</p>
        )}

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-white/20 flex-shrink-0">
            {minLabel ?? (min === 0 && zeroLabel ? zeroLabel : `${min}${unit}`)}
          </span>
          {sliderInput}
          <span className="text-[11px] text-white/20 flex-shrink-0">
            {maxLabel ?? `${max}${unit}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-[var(--text-primary)] inline-flex items-center gap-1.5">
          {icon}{label}
        </label>
        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">
          {displayValue}
        </span>
      </div>

      {sliderInput}

      <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>{min === 0 && zeroLabel ? zeroLabel : `${min}${unit}`}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
