import { useMemo, useState, type FormEvent } from 'react';
import { createRecord, seasonCol, seasonSubDoc, updateRecord } from '../../firestore';
import { errorMessage } from '../../errors';
import { parseLength } from '../../logic/duration';
import { formatDuration } from '../../logic/clockFormat';
import { nextOrder } from '../../logic/records';
import { isHHMM } from '../../logic/season';
import type { Person, PlaybackSource, Segment, SegmentType, WithId } from '../../types';

const SEGMENT_TYPES: SegmentType[] = ['live', 'pretape', 'song', 'intermission'];
const PLAYBACK_SOURCES: PlaybackSource[] = ['slides', 'video', 'browser', 'live-music', 'none'];

/** The usual playback source for a segment type. */
function defaultSource(type: SegmentType): PlaybackSource {
  if (type === 'pretape') return 'video';
  if (type === 'intermission') return 'none';
  if (type === 'song') return 'live-music';
  return 'slides';
}

interface Draft {
  title: string;
  type: SegmentType;
  playbackSource: PlaybackSource;
  length: string;
  hardTime: string;
  ownerPersonIds: string[];
  presenterLabel: string;
  notes: string;
}

function toDraft(segment: WithId<Segment> | null): Draft {
  return {
    title: segment?.title ?? '',
    type: segment?.type ?? 'live',
    playbackSource: segment?.playbackSource ?? 'slides',
    length: segment ? formatDuration(segment.plannedSec) : '5:00',
    hardTime: segment?.hardTime ?? '',
    ownerPersonIds: segment?.ownerPersonIds ?? [],
    presenterLabel: segment?.presenterLabel ?? '',
    notes: segment?.notes ?? '',
  };
}

interface Props {
  seasonId: string;
  /** null = adding a new segment. */
  segment: WithId<Segment> | null;
  segments: WithId<Segment>[];
  people: WithId<Person>[];
  onClose: () => void;
  onDelete: (segment: WithId<Segment>) => void;
}

/** Side panel to add or edit a segment. */
export default function SegmentPanel({ seasonId, segment, segments, people, onClose, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(segment));
  const [sourceTouched, setSourceTouched] = useState(Boolean(segment));
  const [peopleFilter, setPeopleFilter] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sortedPeople = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name)), [people]);
  const filter = peopleFilter.trim().toLowerCase();
  const visiblePeople = sortedPeople.filter(
    (p) => draft.ownerPersonIds.includes(p.id) || !filter || p.name.toLowerCase().includes(filter),
  );

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function setType(type: SegmentType) {
    setDraft((prev) => ({ ...prev, type, playbackSource: sourceTouched ? prev.playbackSource : defaultSource(type) }));
  }

  function toggleOwner(id: string) {
    set(
      'ownerPersonIds',
      draft.ownerPersonIds.includes(id) ? draft.ownerPersonIds.filter((x) => x !== id) : [...draft.ownerPersonIds, id],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const plannedSec = parseLength(draft.length);
    const next: typeof errors = {};
    if (!draft.title.trim()) next.title = 'Give it a title.';
    if (plannedSec === null) next.length = 'Use m:ss or minutes, e.g. 6:30 or 6.5.';
    if (draft.hardTime.trim() && !isHHMM(draft.hardTime.trim())) next.hardTime = 'Use HH:MM, 24-hour.';
    setErrors(next);
    if (Object.keys(next).length > 0 || plannedSec === null) return;

    const fields = {
      title: draft.title.trim(),
      type: draft.type,
      playbackSource: draft.playbackSource,
      plannedSec,
      hardTime: draft.hardTime.trim() || undefined,
      ownerPersonIds: draft.ownerPersonIds,
      presenterLabel: draft.presenterLabel.trim() || undefined,
      notes: draft.notes.trim() || undefined,
    };

    setBusy(true);
    try {
      if (segment) {
        await updateRecord(seasonSubDoc(seasonId, 'segments', segment.id), fields);
      } else {
        await createRecord(seasonCol(seasonId, 'segments'), { ...fields, order: nextOrder(segments) });
      }
      onClose();
    } catch (err) {
      setMessage(`Couldn't save: ${errorMessage(err)}`);
      setBusy(false);
    }
  }

  return (
    <aside className="pl-side-panel" aria-label={segment ? `Edit ${segment.title}` : 'Add segment'}>
      <header className="pl-side-panel-header">
        <h2>{segment ? 'Edit segment' : 'Add segment'}</h2>
        <button type="button" className="pl-btn pl-btn-quiet" onClick={onClose}>
          Close
        </button>
      </header>
      <form className="pl-form" onSubmit={handleSubmit} noValidate>
        <label className="pl-field">
          <span>Title</span>
          <input value={draft.title} onChange={(e) => set('title', e.target.value)} autoFocus />
          {errors.title && <small className="pl-error">{errors.title}</small>}
        </label>
        <div className="pl-field-row">
          <label className="pl-field">
            <span>Type</span>
            <select value={draft.type} onChange={(e) => setType(e.target.value as SegmentType)}>
              {SEGMENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="pl-field">
            <span>Playback</span>
            <select
              value={draft.playbackSource}
              onChange={(e) => {
                setSourceTouched(true);
                set('playbackSource', e.target.value as PlaybackSource);
              }}
            >
              {PLAYBACK_SOURCES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="pl-field-row">
          <label className="pl-field">
            <span>Length</span>
            <input value={draft.length} onChange={(e) => set('length', e.target.value)} placeholder="6:30" />
            {errors.length ? <small className="pl-error">{errors.length}</small> : <small className="pl-muted">m:ss</small>}
          </label>
          <label className="pl-field">
            <span>Hard time</span>
            <input value={draft.hardTime} onChange={(e) => set('hardTime', e.target.value)} placeholder="21:00" />
            {errors.hardTime ? (
              <small className="pl-error">{errors.hardTime}</small>
            ) : (
              <small className="pl-muted">Optional, HH:MM</small>
            )}
          </label>
        </div>

        <fieldset className="pl-field pl-owner-picker">
          <legend>Owners</legend>
          <small className="pl-muted">None = Sean or house.</small>
          <input
            type="search"
            placeholder="Filter people"
            value={peopleFilter}
            onChange={(e) => setPeopleFilter(e.target.value)}
            aria-label="Filter people"
          />
          <div className="pl-owner-list">
            {visiblePeople.length === 0 ? (
              <p className="pl-muted">No people match.</p>
            ) : (
              visiblePeople.map((p) => (
                <label key={p.id} className="pl-check">
                  <input
                    type="checkbox"
                    checked={draft.ownerPersonIds.includes(p.id)}
                    onChange={() => toggleOwner(p.id)}
                  />
                  <span>{p.name}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        <label className="pl-field">
          <span>Presenter label</span>
          <input
            value={draft.presenterLabel}
            onChange={(e) => set('presenterLabel', e.target.value)}
            placeholder="Shown when there are no owners"
          />
        </label>
        <label className="pl-field">
          <span>Notes</span>
          <textarea rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        <div className="pl-form-actions">
          <button type="submit" className="pl-btn pl-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : segment ? 'Save' : 'Add segment'}
          </button>
          {segment && (
            <button type="button" className="pl-btn pl-btn-danger" onClick={() => onDelete(segment)}>
              Delete…
            </button>
          )}
          {message && <span className="pl-form-message">{message}</span>}
        </div>
      </form>
    </aside>
  );
}
