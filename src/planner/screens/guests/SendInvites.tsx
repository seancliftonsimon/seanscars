import { useMemo, useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { seasonSubDoc, updateRecord } from '../../firestore';
import { usePlanner } from '../../hooks/plannerContext';
import { useToast } from '../../components/ui/toastContext';
import { errorMessage } from '../../errors';
import type { Derived } from '../../hooks/useDerived';
import { EmptyState } from '../../components/ui/Basics';
import { ProgressBar } from '../../components/ui/Progress';
import { formatDay, plural } from '../../logic/dates';
import { INVITE_METHOD_LABEL, INVITE_METHODS } from '../../logic/labels';
import { isSent } from '../../logic/invites';
import type { InviteMethod, Invitation, WithId } from '../../types';

/** A guided batch: who is ready to invite, how, and mark them sent. */
export default function SendInvites({ derived, onOpenPerson }: { derived: Derived; onOpenPerson: (id: string) => void }) {
  const { season, data, today } = usePlanner();
  const toast = useToast();
  const [methods, setMethods] = useState<Record<string, InviteMethod>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMethod, setBulkMethod] = useState<InviteMethod>('text');

  const ready = useMemo(
    () =>
      data.invitations
        .filter((i) => i.status === 'invite?' && !isSent(i))
        .map((inv) => ({ inv, person: data.peopleById.get(inv.id) }))
        .filter((r) => r.person)
        .sort((a, b) => a.person!.name.localeCompare(b.person!.name)),
    [data.invitations, data.peopleById],
  );
  const sent = useMemo(
    () =>
      data.invitations
        .filter(isSent)
        .map((inv) => ({ inv, person: data.peopleById.get(inv.id) }))
        .filter((r) => r.person)
        .sort((a, b) => (b.inv.invitedAt ?? '').localeCompare(a.inv.invitedAt ?? '')),
    [data.invitations, data.peopleById],
  );
  if (!season) return null;
  const sid = season.id;
  const { send } = derived;

  async function markSent(list: { inv: WithId<Invitation>; method: InviteMethod }[]) {
    const before = list.map(({ inv }) => ({ id: inv.id, status: inv.status, method: inv.method, invitedAt: inv.invitedAt }));
    try {
      await Promise.all(list.map(({ inv, method }) => updateRecord(seasonSubDoc(sid, 'invitations', inv.id), { status: 'invited', method, invitedAt: today })));
      setSelected(new Set());
      const name = list.length === 1 ? data.peopleById.get(list[0].inv.id)?.name : null;
      toast({
        message: name ? `Invitation to ${name} marked sent` : `${plural(list.length, 'invitation')} marked sent`,
        undo: () =>
          Promise.all(before.map((b) => updateRecord(seasonSubDoc(sid, 'invitations', b.id), { status: b.status, method: b.method, invitedAt: b.invitedAt }))),
      });
    } catch (err) {
      toast({ message: `Couldn’t save: ${errorMessage(err)}`, tone: 'danger' });
    }
  }

  const methodFor = (inv: WithId<Invitation>) => methods[inv.id] ?? inv.method ?? 'text';
  const allSelected = ready.length > 0 && ready.every((r) => selected.has(r.inv.id));

  return (
    <div className="pl-stack pl-send">
      <div className="pl-card">
        <div className="pl-row is-between">
          <p className="pl-verdict is-ok">
            <Send size={18} aria-hidden />
            <span>
              <strong className="pl-num">{send.sent}</strong> of {send.total} invitations sent
              {send.toSend > 0 ? ` · ${send.toSend} to go` : ' · all out'}
            </span>
          </p>
        </div>
        <ProgressBar value={send.sent} max={send.total} label="Invitations sent" tone={send.toSend ? 'accent' : 'good'} />
      </div>

      {ready.length === 0 ? (
        <EmptyState icon={CheckCircle2} title={send.total ? 'Everyone on the list has been invited.' : 'No one is on the list yet.'} compact>
          {send.total ? 'Replies will show up under Replies; the quiet ones under Waiting.' : 'Add guests on the Guest list first; anyone marked “On the list” shows up here, ready to send.'}
        </EmptyState>
      ) : (
        <>
          <div className="pl-row is-between">
            <label className="pl-check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(ready.map((r) => r.inv.id)))}
              />
              <span>Ready to send ({ready.length})</span>
            </label>
            <span className="pl-small pl-muted">Choose how you’ll reach each person, then mark them sent.</span>
          </div>
          <ul className="pl-list" aria-label="Ready to send">
            {ready.map(({ inv, person }) => (
              <li key={inv.id}>
                <div className="pl-list-row">
                  <input
                    type="checkbox"
                    checked={selected.has(inv.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (!next.delete(inv.id)) next.add(inv.id);
                        return next;
                      })
                    }
                    aria-label={`Select ${person!.name}`}
                  />
                  <div className="pl-list-main">
                    <button type="button" className="pl-list-title" onClick={() => onOpenPerson(inv.id)}>
                      {person!.name}
                    </button>
                    <span className="pl-list-meta">{person!.email ?? 'No email on file'}{inv.plusOnes ? ` · +${inv.plusOnes}` : ''}</span>
                  </div>
                  <div className="pl-list-actions">
                    <span className="pl-seg-ctl" role="group" aria-label={`How to invite ${person!.name}`}>
                      {INVITE_METHODS.map((m) => (
                        <button key={m} type="button" aria-pressed={methodFor(inv) === m} onClick={() => setMethods((prev) => ({ ...prev, [inv.id]: m }))}>
                          {INVITE_METHOD_LABEL[m]}
                        </button>
                      ))}
                    </span>
                    <button type="button" className="pl-btn pl-btn-sm" onClick={() => void markSent([{ inv, method: methodFor(inv) }])}>
                      <Send size={14} aria-hidden /> Sent
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {selected.size > 0 && (
        <div className="pl-bulkbar">
          <strong>{selected.size} selected</strong>
          <span className="pl-seg-ctl" role="group" aria-label="Method for all selected">
            {INVITE_METHODS.map((m) => (
              <button key={m} type="button" aria-pressed={bulkMethod === m} onClick={() => setBulkMethod(m)}>
                {INVITE_METHOD_LABEL[m]}
              </button>
            ))}
          </span>
          <button
            type="button"
            className="pl-btn pl-btn-primary pl-btn-sm"
            onClick={() => void markSent(ready.filter((r) => selected.has(r.inv.id)).map((r) => ({ inv: r.inv, method: methods[r.inv.id] ?? bulkMethod })))}
          >
            Mark {selected.size} sent today
          </button>
          <button type="button" className="pl-btn pl-btn-quiet" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {sent.length > 0 && (
        <details className="pl-details">
          <summary>Already sent ({sent.length})</summary>
          <ul className="pl-list">
            {sent.map(({ inv, person }) => (
              <li key={inv.id}>
                <div className="pl-list-row">
                  <div className="pl-list-main">
                    <button type="button" className="pl-list-title" onClick={() => onOpenPerson(inv.id)}>
                      {person!.name}
                    </button>
                  </div>
                  <span className="pl-small pl-muted">
                    {inv.method ? INVITE_METHOD_LABEL[inv.method] : 'Sent'}
                    {inv.invitedAt ? ` · ${formatDay(inv.invitedAt)}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
