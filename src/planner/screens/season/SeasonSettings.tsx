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
        <TextField label="Capacity" name="capacity" type="number" {...fieldProps} />
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

export default function SeasonSettings() {
  const { seasons, season, setSeasonId, loading, error } = useSeason();

  return (
    <section className="pl-screen">
      <header className="pl-screen-header">
        <h1>Season settings</h1>
      </header>

      <div className="pl-panel">
        <h2>Seasons</h2>
        {loading ? (
          <p className="pl-muted">Loading…</p>
        ) : error ? (
          <p className="pl-error">Couldn't load seasons: {errorMessage(error)}</p>
        ) : seasons.length === 0 ? (
          <p className="pl-empty">No seasons yet. Create the first one below.</p>
        ) : (
          <table className="pl-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Name</th>
                <th>Show date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={s.id} className={s.id === season?.id ? 'is-selected' : undefined}>
                  <td>
                    <button type="button" className="pl-link-btn" onClick={() => setSeasonId(s.id)}>
                      {s.year}
                    </button>
                  </td>
                  <td>{s.name}</td>
                  <td>{s.showDate ?? '—'}</td>
                  <td>{s.archived ? 'Archived' : s.id === season?.id ? 'Selected' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <CreateSeasonForm />
      </div>

      {season && (
        <div className="pl-panel">
          <h2>Edit {season.year}</h2>
          <EditSeasonForm key={season.id} season={season} />
        </div>
      )}
    </section>
  );
}
