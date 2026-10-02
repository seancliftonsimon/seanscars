import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tone } from './Chip';

interface StatProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
}

export function StatCard({ label, value, sub, tone = 'neutral', icon: Icon }: StatProps) {
  return (
    <div className={`pl-stat is-${tone}`}>
      <span className="pl-stat-label">
        {Icon && <Icon size={14} aria-hidden />}
        {label}
      </span>
      <span className="pl-stat-value">{value}</span>
      {sub && <span className="pl-stat-sub">{sub}</span>}
    </div>
  );
}

interface EmptyProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

/** Says what the screen is for and offers the first action. */
export function EmptyState({ icon: Icon, title, children, action, compact }: EmptyProps) {
  return (
    <div className={`pl-emptystate${compact ? ' is-compact' : ''}`}>
      <span className="pl-emptystate-icon">
        <Icon size={compact ? 18 : 22} aria-hidden />
      </span>
      <div>
        <p className="pl-emptystate-title">{title}</p>
        {children && <div className="pl-emptystate-body">{children}</div>}
        {action && <div className="pl-emptystate-action">{action}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="pl-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} style={{ width: `${92 - ((i * 17) % 35)}%` }} />
      ))}
    </div>
  );
}

interface HeaderProps {
  title: string;
  /** The plain-language answer for this screen, shown under the title. */
  answer?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

export function PageHeader({ title, answer, actions, eyebrow }: HeaderProps) {
  return (
    <header className="pl-page-header">
      <div className="pl-page-header-text">
        {eyebrow && <p className="pl-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {answer && <div className="pl-page-answer">{answer}</div>}
      </div>
      {actions && <div className="pl-page-actions">{actions}</div>}
    </header>
  );
}

export function Section({ title, aside, children, id }: { title: ReactNode; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="pl-section" id={id} aria-label={typeof title === 'string' ? title : undefined}>
      <header className="pl-section-head">
        <h2>{title}</h2>
        {aside && <div className="pl-section-aside">{aside}</div>}
      </header>
      {children}
    </section>
  );
}
