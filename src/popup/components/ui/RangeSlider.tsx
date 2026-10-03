import React from 'react';
import './range-slider.css';

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
  /** Custom rendered value, for example a semantic position label. */
  valueLabel?: React.ReactNode;
  /** Input-only mode for custom layouts such as the equalizer and color picker. */
  bare?: boolean;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  /** Keeps specialized tracks (for example hue) while sharing the same control. */
  trackBackground?: string;
  onCommit?: () => void;
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
  valueLabel,
  bare = false,
  orientation = 'horizontal',
  ariaLabel,
  trackBackground,
  onCommit,
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
      onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      aria-label={ariaLabel ?? label}
      aria-orientation={orientation}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      onBlur={onCommit}
      className={`vkify-range vkify-range--${orientation}`}
      style={{
        background: trackBackground ?? `linear-gradient(to ${orientation === 'vertical' ? 'top' : 'right'}, var(--primary) 0%, var(--primary) ${percentage}%, var(--bg-tertiary) ${percentage}%, var(--bg-tertiary) 100%)`,
      }}
    />
  );

  if (bare) return sliderInput;

  if (inline) {
    return (
      <div className="range-slider range-slider--inline">
        <div className="range-slider__header">
          <label htmlFor={id} className="range-slider__label">
            {icon}{label}
          </label>
          <span className="range-slider__value">
            {valueLabel ?? `${value}${unit}`}
          </span>
        </div>

        {description && (
          <p className="text-[10px] text-[var(--text-tertiary)] -mt-1">{description}</p>
        )}

        <div className="flex items-center gap-2.5">
          <span className="text-[11px] text-[var(--text-tertiary)] flex-shrink-0">
            {minLabel ?? (min === 0 && zeroLabel ? zeroLabel : `${min}${unit}`)}
          </span>
          {sliderInput}
          <span className="text-[11px] text-[var(--text-tertiary)] flex-shrink-0">
            {maxLabel ?? `${max}${unit}`}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="range-slider">
      <div className="range-slider__header">
        <label htmlFor={id} className="range-slider__label">
          {icon}{label}
        </label>
        <span className="range-slider__value">
          {valueLabel ?? displayValue}
        </span>
      </div>

      {sliderInput}

      <div className="range-slider__limits">
        <span>{min === 0 && zeroLabel ? zeroLabel : `${min}${unit}`}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}
