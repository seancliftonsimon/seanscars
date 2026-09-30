import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeason } from '../../hooks/useSeason';
import { savePieceTemplate } from '../../firestore';
import { errorMessage } from '../../errors';
import { defaultSteps, PIECE_KIND_LABELS, reusableSteps, uniqueStepKey } from '../../logic/steps';
import type { PieceKind, PieceTemplates } from '../../types';

const KINDS = Object.keys(PIECE_KIND_LABELS) as PieceKind[];

function TemplateEditor({ seasonId, kind, templates }: { seasonId: string; kind: PieceKind; templates?: PieceTemplates }) {
  const storageKey = `pl-template-draft:${seasonId}:${kind}`;
  const [initial] = useState(() => {
    const defaults = reusableSteps(defaultSteps(kind, 'todo', templates));
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
      if (stored && Array.isArray(stored.steps) && stored.steps.every((s: { key?: unknown; label?: unknown }) => typeof s.key === 'string' && typeof s.label === 'string') && typeof stored.baseline === 'string') return stored as { steps: typeof defaults; baseline: string };
    } catch { /* Use the saved template if browser storage is unavailable. */ }
    return { steps: defaults, baseline: JSON.stringify(defaults) };
  });
  const [steps, setSteps] = useState(initial.steps);
  const [baseline, setBaseline] = useState(initial.baseline);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const dirty = JSON.stringify(steps) !== baseline;
  const valid = steps.length > 0 && steps.every((step) => step.label.trim());

  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(storageKey, JSON.stringify({ steps, baseline }));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Saving to Firestore still works without browser storage. */ }
  }, [storageKey, steps, baseline, dirty]);

  function change(next: typeof steps) { setSteps(next); setMessage(''); }
  function move(index: number, delta: number) {
    const next = [...steps];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    change(next);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setMessage('');
    const trimmed = steps.map((step) => ({ ...step, label: step.label.trim() }));
    try {
      await savePieceTemplate(seasonId, kind, trimmed);
      setSteps(trimmed);
      setBaseline(JSON.stringify(trimmed));
      setMessage('Template saved. New pieces will use these tasks.');
    } catch (err) { setMessage(`Couldn't save: ${errorMessage(err)}`); }
    finally { setBusy(false); }
  }
  return (
    <form className="pl-panel pl-template-editor" onSubmit={(e) => void save(e)}>
      <div><span className="pl-eyebrow">Default checklist</span><h2>{PIECE_KIND_LABELS[kind]}</h2></div>
      <p className="pl-muted">Put tasks in the order you usually do them. Every new piece starts with these tasks marked “To do.”</p>
      <fieldset disabled={busy} className="pl-template-fields">
        <ol className="pl-template-steps">
          {steps.map((step, index) => (
            <li key={step.key}>
              <span className="pl-step-number" aria-hidden="true">{index + 1}</span>
              <label className="pl-field"><span className="pl-sr-only">Task {index + 1}</span>
                <input value={step.label} onChange={(e) => change(steps.map((s, i) => i === index ? { ...s, label: e.target.value } : s))} />
              </label>
              <div className="pl-step-actions">
                <button type="button" className="pl-btn pl-btn-quiet" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move task ${index + 1} up`}>↑</button>
                <button type="button" className="pl-btn pl-btn-quiet" disabled={index === steps.length - 1} onClick={() => move(index, 1)} aria-label={`Move task ${index + 1} down`}>↓</button>
                <button type="button" className="pl-btn pl-btn-quiet" onClick={() => change(steps.filter((_, i) => i !== index))} aria-label={`Remove task ${index + 1}`}>Remove</button>
              </div>
            </li>
          ))}
        </ol>
        <div className="pl-inline-form">
          <label className="pl-field pl-grow"><span>New task</span><input value={newLabel} placeholder="e.g. Record a rehearsal" onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); if (newLabel.trim()) { change([...steps, { key: uniqueStepKey(newLabel, steps), label: newLabel.trim() }]); setNewLabel(''); } }
          }} /></label>
          <button type="button" className="pl-btn" disabled={!newLabel.trim()} onClick={() => { change([...steps, { key: uniqueStepKey(newLabel, steps), label: newLabel.trim() }]); setNewLabel(''); }}>Add task</button>
        </div>
      </fieldset>
      {!valid && <p className="pl-error">Keep at least one task and give every task a name.</p>}
      <div className="pl-form-actions">
        <button className="pl-btn pl-btn-primary" disabled={busy || !valid || !dirty}>{busy ? 'Saving…' : 'Save template'}</button>
        <button type="button" className="pl-btn pl-btn-quiet" disabled={busy} onClick={() => {
          if (window.confirm('Replace this draft with the original checklist? Save to apply it to future pieces.')) change(reusableSteps(defaultSteps(kind)));
        }}>Use original checklist</button>
        <span className="pl-muted" role="status">{message || (dirty ? 'Unsaved draft · kept in this browser tab' : '')}</span>
      </div>
    </form>
  );
}

export default function TemplatesScreen() {
  const { season, loading, error } = useSeason();
  const [params, setParams] = useSearchParams();
  const selected = params.get('kind') as PieceKind;
  const kind = KINDS.includes(selected) ? selected : 'song';
  return (
    <section className="pl-screen">
      <header className="pl-screen-header"><h1>Task templates</h1><span className="pl-muted">{season?.year}</span></header>
      {loading ? <p className="pl-muted">Loading templates…</p> : error ? <p className="pl-error">Couldn't load: {errorMessage(error)}</p> : !season ? <p className="pl-empty"><Link to="/plan/season">Create a season</Link> to save your templates.</p> : <>
        <label className="pl-field pl-template-picker"><span>Production type</span><select value={kind} onChange={(e) => setParams({ kind: e.target.value })}>{KINDS.map((k) => <option key={k} value={k}>{PIECE_KIND_LABELS[k]}</option>)}</select></label>
        <TemplateEditor key={`${season.id}-${kind}`} seasonId={season.id} kind={kind} templates={season.pieceTemplates} />
        <details className="pl-page-help"><summary>How templates work</summary><p>Templates are shared within this season and copied when you start a season from it. Editing a template leaves existing pieces and their progress as they are.</p></details>
        <p className="pl-muted">Ready to use it? <Link to={`/plan/awards?tab=pieces&piece=new&kind=${kind}`}>Create a {PIECE_KIND_LABELS[kind].toLowerCase()} piece</Link> or <Link to="/plan/films">develop an idea</Link>.</p>
      </>}
    </section>
  );
}
