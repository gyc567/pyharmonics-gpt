"use client";

import { cn } from "@/lib/utils";

interface InputSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

export function InputSlider({
  label,
  value,
  min,
  max,
  step = 0.01,
  suffix = "%",
  disabled,
  onChange,
  className,
}: InputSliderProps) {
  const displayValue = Math.round(value * 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <span className="text-xs font-semibold text-foreground">
          {displayValue}
          {suffix}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="slider-surface flex-1"
          aria-label={label}
        />
        <input
          type="number"
          min={min * 100}
          max={max * 100}
          step={step * 100}
          value={displayValue}
          disabled={disabled}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") return;
            const num = Number(raw);
            onChange(Math.min(max, Math.max(min, num / 100)));
          }}
          className="input-surface w-20 py-1.5 text-center"
          aria-label={`${label} 数值`}
        />
      </div>
    </div>
  );
}
