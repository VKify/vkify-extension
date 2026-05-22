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
}: RangeSliderProps) {
  const displayValue = value === 0 && zeroLabel ? zeroLabel : `${value}${unit}`;
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--text-primary)]">
          {label}
        </label>
        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">
          {displayValue}
        </span>
      </div>

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

      <div className="flex justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>{min === 0 && zeroLabel ? zeroLabel : `${min}${unit}`}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}