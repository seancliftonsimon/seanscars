import { Minus, Plus } from 'lucide-react';

/** − n + for small counts like plus-ones. */
export function Stepper({ value, onChange, label, min = 0, max = 9 }: { value: number; onChange: (n: number) => void; label: string; min?: number; max?: number }) {
  return (
    <span className="pl-stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>
        <Minus size={12} aria-hidden />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>
        <Plus size={12} aria-hidden />
      </button>
    </span>
  );
}
