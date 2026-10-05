import { Radio } from 'lucide-react';
import { usePlanner } from '../../hooks/plannerContext';
import { useDerived } from '../../hooks/useDerived';
import { Chip } from '../../components/ui/Chip';

/** Last publish to the timer, and whether the plan has changed since. */
export function PublishStatus() {
  const { season, data } = usePlanner();
  const d = useDerived();
  if (!season || !d) return null;
  const last = data.publishes[0];
  if (!last) return <p className="pl-small pl-muted pl-publish-line"><Radio size={14} aria-hidden /> Not published to the Backstage Timer yet.</p>;
  const live = last.targetDocId === season.timerDocId;
  const when = last.at ? last.at.toDate().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'just now';
  return (
    <p className="pl-small pl-muted pl-publish-line">
      <Radio size={14} aria-hidden /> Last published {when} to the {live ? 'live timer' : 'test copy'}{' '}
      {d.changedSinceLast === true && <Chip tone="warn">Plan changed since</Chip>}
      {d.changedSinceLast === false && <Chip tone="good">Matches the plan</Chip>}
    </p>
  );
}
