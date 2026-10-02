import type { Tone } from './Chip';

interface BarProps {
  value: number;
  max: number;
  tone?: Tone;
  label: string;
  /** Thin (4px) or regular (8px). */
  size?: 'sm' | 'md';
}

export function ProgressBar({ value, max, tone = 'accent', label, size = 'md' }: BarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={`pl-progress is-${size} is-${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

interface RingProps {
  done: number;
  total: number;
  size?: number;
  label?: string;
}

/** Steps done as a ring, with the count inside. */
export function ProgressRing({ done, total, size = 34, label }: RingProps) {
  const r = (size - 5) / 2;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? done / total : 1;
  const complete = total > 0 && done >= total;
  return (
    <span
      className={`pl-ring${complete ? ' is-complete' : ''}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label ?? `${done} of ${total} steps done`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="pl-ring-track" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="pl-ring-fill"
          strokeDasharray={`${c * frac} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="pl-ring-text">{complete ? '✓' : `${done}/${total}`}</span>
    </span>
  );
}

export interface CapacityLayer {
  key: string;
  label: string;
  value: number;
  tone: Tone;
}

interface CapacityBarProps {
  /** Nested totals, smallest first (confirmed ⊂ likely ⊂ everyone). */
  layers: CapacityLayer[];
  capacity: number | null;
  label: string;
}

/**
 * Nested headcount layers against a capacity line, like an event tool's
 * capacity meter. Anything past the line is hatched.
 */
export function CapacityBar({ layers, capacity, label }: CapacityBarProps) {
  const top = Math.max(capacity ?? 0, ...layers.map((l) => l.value), 1);
  const scale = top * 1.05;
  const pct = (n: number) => `${(n / scale) * 100}%`;
  return (
    <div className="pl-capbar" role="img" aria-label={label}>
      {[...layers].reverse().map((l) => (
        <span key={l.key} className={`pl-capbar-layer is-${l.tone}`} style={{ width: pct(l.value) }} />
      ))}
      {capacity !== null && (
        <>
          <span className="pl-capbar-over" style={{ left: pct(capacity), width: `calc(${pct(Math.max(0, top - capacity))})` }} />
          <span className="pl-capbar-line" style={{ left: pct(capacity) }}>
            <span>{capacity}</span>
          </span>
        </>
      )}
    </div>
  );
}
