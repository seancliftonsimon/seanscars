import { useState, type FormEvent } from 'react';
import { useSeason } from '../../hooks/useSeason';
import { createRecord, seasonDoc, updateRecord } from '../../firestore';
import {
  defaultSeason,
  draftToPatch,
  isPublishableTimerDocId,
  isValidSeasonYear,
  seasonToDraft,
  suggestNextYear,
  type SeasonDraft,
  type SeasonDraftErrors,
} from '../../logic/season';
import type { Season, WithId } from '../../types';
import StartFromPrevious from './StartFromPrevious';
import { Link } from 'react-router-dom';
import { usePlanner } from '../../hooks/plannerContext';
import { PageHeader, Skeleton } from '../../components/ui/Basics';
import './season.css';

function errorMessage(err: unknown): string {
  const code = (err as { code?: string }).code;
  if (code === 'permission-denied') {
    return 'Permission denied. Have the planner security rules been published?';
  }
  return err instanceof Error ? err.message : String(err);
}

function CreateSeasonForm() {
  const { seasons, setSeasonId } = useSeason();
  const [yearText, setYearText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const suggested = suggestNextYear(seasons);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const year = Number(yearText.trim() || suggested);
    if (!isValidSeasonYear(year)) {
      setMessage('Enter a year between 2000 and 2099.');
      return;
    }
    const id = String(year);
    if (seasons.some((s) => s.id === id)) {
      setMessage(`Season ${id} already exists.`);
      setSeasonId(id);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await createRecord(seasonDoc(id), defaultSeason(year));
      setSeasonId(id);
      setYearText('');
      setMessage(`Created season ${id}.`);
    } catch (err) {
      setMessage(`Couldn't create season: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="pl-inline-form" onSubmit={handleSubmit}>
      <label className="pl-field pl-field-narrow">
        <span>Year</span>
        <input
          type="number"
          inputMode="numeric"
          min={2000}
          max={2099}
          placeholder={String(suggested)}
          value={yearText}
          onChange={(e) => setYearText(e.target.value)}
        />
      </label>
      <button type="submit" className="pl-btn pl-btn-primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create season'}
      </button>
      {message && <p className="pl-form-message">{message}</p>}
    </form>
  );
}

interface FieldProps {
  label: string;
  name: keyof SeasonDraft;
  draft: SeasonDraft;
  errors: SeasonDraftErrors;
  onChange: (name: keyof SeasonDraft, value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
  wide?: boolean;
}

function TextField({ label, name, draft, errors, onChange, placeholder, hint, type = 'text', wide }: FieldProps) {
  const error = errors[name];
  return (
    <label className={wide ? 'pl-field pl-field-wide' : 'pl-field'}>
      <span>{label}</span>
      <input
        type={type}
        value={String(draft[name])}
        placeholder={placeholder}
        onChange={(e) => onChange(name, e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {error ? <small className="pl-error">{error}</small> : hint ? <small className="pl-muted">{hint}</small> : null}
    </label>
  );
}

function EditSeasonForm({ season }: { season: WithId<Season> }) {
  const [draft, setDraft] = useState<SeasonDraft>(() => seasonToDraft(season));
  const [errors, setErrors] = useState<SeasonDraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function change(name: keyof SeasonDraft, value: string | boolean) {
    setDraft((prev) => ({ ...prev, [name]: value }));
    setMessage(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = draftToPatch(draft);
    if (!result.ok) {
      setErrors(result.errors);
      setMessage('Fix the highlighted fields.');
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await updateRecord(seasonDoc(season.id), result.patch);
      setMessage('Saved.');
    } catch (err) {
      setMessage(`Couldn't save: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const fieldProps = { draft, errors, onChange: change };
  const timerWarning =
    draft.timerDocId.trim() && !isPublishableTimerDocId(draft.timerDocId.trim())
      ? 'Publishing to the timer only works for ids like seanscars-2027-rundown (or …-rundown-test).'
      : undefined;

  return (
    <form className="pl-form" onSubmit={handleSubmit} noValidate>
      <div className="pl-form-grid">
        <TextField label="Name" name="name" wide {...fieldProps} />
        <TextField label="Show date" name="showDate" type="date" hint="YYYY-MM-DD" {...fieldProps} />
        <TextField label="Doors" name="doorsTime" placeholder="18:30" hint="HH:MM, 24-hour" {...fieldProps} />
        <TextField label="Show start" name="showStartTime" placeholder="19:00" hint="HH:MM, 24-hour" {...fieldProps} />
        <TextField label="Runtime cap (min)" name="runtimeCapMin" type="number" {...fieldProps} />
        <TextField label="Buffer target (min)" name="bufferTargetMin" type="number" {...fieldProps} />
        <TextField label="Capacity (guests incl. plus-ones)" name="capacity" type="number" hint="Also set when you book a venue" {...fieldProps} />
        <TextField label="Timer doc id" name="timerDocId" hint={timerWarning} wide {...fieldProps} />
        <TextField label="Master deck URL" name="masterDeckUrl" type="url" wide {...fieldProps} />
        <TextField label="Drive folder URL" name="driveFolderUrl" type="url" wide {...fieldProps} />
        <TextField label="Theme" name="theme" wide {...fieldProps} />
        <label className="pl-field pl-field-check">
          <input type="checkbox" checked={draft.archived} onChange={(e) => change('archived', e.target.checked)} />
          <span>Archived</span>
        </label>
      </div>
      <div className="pl-form-actions">
        <button type="submit" className="pl-btn pl-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {message && <span className="pl-form-message">{message}</span>}
      </div>
    </form>
  );
}

function SetupSteps({ season }: { season: WithId<Season> }) {
  const { data } = usePlanner();
  const steps = [
    { done: true, title: `Create the ${season.year} season`, href: null },
    { done: Boolean(season.showDate && season.capacity), title: 'Set the date, start time and capacity', href: '#season-details' },
    { done: data.segments.length > 0 || data.awards.length > 0, title: 'Start from last year (awards, your segments, returning guests)', href: '#season-rollover' },
    { done: data.films.length > 0, title: 'Bring in films and ideas', href: '/plan/import' },
    { done: Boolean(season.venueOptionId), title: 'Choose and book a venue', href: '/plan/prep?view=venues' },
  ];
  const done = steps.filter((s) => s.done).length;
  return (
    <section className="pl-card" aria-label="Setup steps">
      <p className="pl-strong">
        {done === steps.length ? `${season.year} is set up.` : `${done} of ${steps.length} setup steps done for ${season.year}.`}
      </p>
      <ol className="pl-setup-steps">
        {steps.map((s, i) => (
          <li key={i} className={s.done ? 'is-done' : undefined}>
            <span className="pl-step-num" aria-hidden>{s.done ? '✓' : i + 1}</span>
            {s.href && !s.done ? (
              s.href.startsWith('#') ? <a href={s.href} onClick={(e) => { e.preventDefault(); document.querySelector(s.href!)?.scrollIntoView({ behavior: 'smooth' }); }}>{s.title}</a> : <Link to={s.href}>{s.title}</Link>
            ) : (
              <span>{s.title}{s.done ? <span className="pl-visually-hidden"> (done)</span> : null}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function SeasonSettings() {
  const { seasons, season, setSeasonId, loading, error } = useSeason();

  return (
    <div className="pl-page is-narrow pl-setup">
      <PageHeader
        title="Season setup"
        answer={season ? 'A short checklist for the start of the year, then the season’s settings.' : 'Create the first season to start planning.'}
      />
      {season && <SetupSteps season={season} />}

      {season && (
        <section className="pl-panel" id="season-details">
          <h2>{season.year} details</h2>
          <EditSeasonForm key={season.id} season={season} />
        </section>
      )}

      {seasons.length > 0 && <div id="season-rollover"><StartFromPrevious /></div>}

      <section className="pl-panel">
        <h2>All seasons</h2>
        {loading ? (
          <Skeleton rows={3} label="Loading seasons" />
        ) : error ? (
          <p className="pl-error">Couldn't load seasons: {errorMessage(error)}</p>
        ) : seasons.length === 0 ? (
          <p className="pl-muted">No seasons yet. Create the first one below.</p>
        ) : (
          <ul className="pl-list">
            {seasons.map((s) => (
              <li key={s.id}>
                <div className={`pl-list-row${s.id === season?.id ? ' is-highlight' : ''}`}>
                  <div className="pl-list-main">
                    <span className="pl-list-title">{s.name}</span>
                    <span className="pl-list-meta">{s.showDate ?? 'No date'}{s.archived ? ' · Archived' : ''}</span>
                  </div>
                  {s.id === season?.id ? (
                    <span className="pl-small pl-muted">Open now</span>
                  ) : (
                    <button type="button" className="pl-btn pl-btn-sm" onClick={() => setSeasonId(s.id)}>Switch to {s.year}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <CreateSeasonForm />
      </section>
    </div>
  );
}
