import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'danger' | 'info' | 'faint';

interface ChipProps {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  title?: string;
  className?: string;
}

/** A status pill: tinted, with an icon or word so color is never the only cue. */
export function Chip({ tone = 'neutral', icon: Icon, children, title, className }: ChipProps) {
  return (
    <span className={`pl-chip is-${tone}${className ? ` ${className}` : ''}`} title={title}>
      {Icon && <Icon size={13} aria-hidden strokeWidth={2.25} />}
      <span>{children}</span>
    </span>
  );
}

export interface ChipOption<V extends string> {
  value: V;
  label: string;
  tone?: Tone;
  icon?: LucideIcon;
}

interface ChipSelectProps<V extends string> {
  value: V | '';
  options: ChipOption<V>[];
  onChange: (value: V) => void;
  /** Accessible name, e.g. "Status for Avery". */
  label: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * A chip that is really a native <select>: looks like a status pill, and
 * opens the platform picker (great on phones, keyboard friendly).
 */
export function ChipSelect<V extends string>({ value, options, onChange, label, placeholder = 'Choose', disabled }: ChipSelectProps<V>) {
  const current = options.find((o) => o.value === value);
  const Icon = current?.icon;
  return (
    <span className={`pl-chip pl-chip-select is-${current?.tone ?? 'faint'}${disabled ? ' is-disabled' : ''}`}>
      {Icon && <Icon size={13} aria-hidden strokeWidth={2.25} />}
      <span>{current?.label ?? placeholder}</span>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="pl-chip-caret">
        <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(e) => e.target.value && onChange(e.target.value as V)}
      >
        {!current && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}
