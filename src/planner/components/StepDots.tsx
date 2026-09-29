import type { PieceStep } from '../types';
import './stepDots.css';

interface Props {
  steps: PieceStep[];
  /** When given, dots are buttons that call this with the step index. */
  onCycle?: (index: number) => void;
  size?: 'sm' | 'md';
}

/** One dot per step: hollow = todo, half gold = doing, filled gold = done. */
export default function StepDots({ steps, onCycle, size = 'sm' }: Props) {
  return (
    <span className={`pl-dots pl-dots-${size}`}>
      {steps.map((step, index) => {
        const text = `${step.label}: ${step.status}`;
        const cls = `pl-dot pl-dot-${step.status}`;
        return onCycle ? (
          <button
            key={`${step.key}-${index}`}
            type="button"
            className={cls}
            title={text}
            aria-label={text}
            onClick={() => onCycle(index)}
          />
        ) : (
          <span key={`${step.key}-${index}`} className={cls} title={text} aria-label={text} role="img" />
        );
      })}
    </span>
  );
}
