import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

type Mode = 'setup' | 'presentation';
type SegmentType = 'live' | 'pretape' | 'intermission';

interface Segment {
  id: string;
  title: string;
  presenter: string;
  type: SegmentType;
  durationSec: number;
}

interface PersistedSetupState {
  showStartTime: string;
  segments: Segment[];
  updatedAtMs: number;
}

interface CompletedRun {
  segmentId: string;
  elapsedSec: number;
  bankBeforeSec: number;
  bankAfterSec: number;
}

interface SortableSegmentRowProps {
  segment: Segment;
  index: number;
  scheduledStartLabel: string;
  onPatchSegment: (segmentId: string, patch: Partial<Segment>) => void;
  onDeleteSegment: (segmentId: string) => void;
  onDurationMinutesChange: (segmentId: string, minutes: number) => void;
  onDurationSecondsChange: (segmentId: string, seconds: number) => void;
  onNudgeDuration: (segmentId: string, deltaSec: number) => void;
}

const STORAGE_KEY = 'seanscars-stage-timer-v1';
const DEFAULT_SHOW_START_TIME = '19:00';
const MAX_BONUS_PER_SEGMENT_SEC = 4 * 60;
const SEGMENT_TYPES: SegmentType[] = ['live', 'pretape', 'intermission'];
const RUN_OF_SHOW_COLLECTION = 'showConfigs';
const DEFAULT_RUN_OF_SHOW_DOC_ID = 'seanscars-2026-rundown';
const configuredRunOfShowDocId = import.meta.env.VITE_RUN_OF_SHOW_DOC_ID?.trim();
const RUN_OF_SHOW_DOC_ID = configuredRunOfShowDocId || DEFAULT_RUN_OF_SHOW_DOC_ID;

const DEFAULT_SEGMENTS: Segment[] = [
  { id: 'seg-01', title: 'Opening Countdown', presenter: 'Sharemony', type: 'pretape', durationSec: 4 * 60 },
  { id: 'seg-02', title: 'Opening Medley', presenter: 'Sean Simon', type: 'pretape', durationSec: 6 * 60 },
  { id: 'seg-03', title: 'Welcome & Initial Awards', presenter: 'Sean Simon', type: 'live', durationSec: 5 * 60 },
  { id: 'seg-04', title: 'Drive - AcADAMy edit', presenter: 'Adam Taylor', type: 'pretape', durationSec: 1 * 60 },
  { id: 'seg-05', title: 'The NANAs', presenter: 'Ana Deros & Nathan Smith', type: 'live', durationSec: 6 * 60 },
  { id: 'seg-06', title: 'The Carrie Awards', presenter: 'Cara Salfino', type: 'live', durationSec: 10 * 60 },
  { id: 'seg-07', title: 'The SAMMYs', presenter: 'Sam Gallen', type: 'live', durationSec: 6 * 60 },
  { id: 'seg-08', title: 'SAMMYs Song', presenter: 'Sam Gallen', type: 'pretape', durationSec: 3 * 60 },
  {
    id: 'seg-09',
    title: 'The Bucatinis',
    presenter: 'Anneliese Mahoney & Travis Ratner',
    type: 'live',
    durationSec: 9 * 60,
  },
  {
    id: 'seg-10',
    title: 'The MAG Awards',
    presenter: 'Maggie Koons & Foster Garrett',
    type: 'live',
    durationSec: 10 * 60,
  },
  {
    id: 'seg-11',
    title: 'Maggie and Foster Song',
    presenter: 'Maggie Koons & Foster Garrett',
    type: 'pretape',
    durationSec: 4 * 60,
  },
  {
    id: 'seg-12',
    title: 'The Madame Web Medical Accuracy Awards',
    presenter: 'Tyler Schwab',
    type: 'live',
    durationSec: 7 * 60,
  },
  {
    id: 'seg-13',
    title: "I'm Good Duet",
    presenter: 'Cassie Collentine & Hannah Litman',
    type: 'pretape',
    durationSec: 4 * 60,
  },
  { id: 'seg-14', title: 'IntermisSEAN', presenter: 'Sharemony', type: 'intermission', durationSec: 15 * 60 },
  { id: 'seg-15', title: 'House - AcADAMy edit', presenter: 'Adam Taylor', type: 'pretape', durationSec: 1 * 60 },
  { id: 'seg-16', title: 'The Thomonto Film Festival', presenter: 'Thom Fusco', type: 'live', durationSec: 15 * 60 },
  { id: 'seg-17', title: 'The Hangoria Awards', presenter: 'Hannah Litman', type: 'live', durationSec: 15 * 60 },
  { id: 'seg-18', title: 'No Hot Take Song', presenter: 'Hannah Litman', type: 'pretape', durationSec: 4 * 60 },
  { id: 'seg-19', title: 'Movie Poster Showcase', presenter: 'Katelyn Greller', type: 'live', durationSec: 7 * 60 },
  { id: 'seg-20', title: 'The Adam Awards', presenter: 'Adam Taylor', type: 'live', durationSec: 15 * 60 },
  { id: 'seg-21', title: 'Opalite - AcADAMy edit', presenter: 'Adam Taylor', type: 'pretape', durationSec: 2 * 60 },
  { id: 'seg-22', title: 'Seanscars', presenter: 'Sean Simon', type: 'live', durationSec: 20 * 60 },
  { id: 'seg-23', title: 'Finale and Goodnights', presenter: 'Sharemony', type: 'live', durationSec: 2 * 60 },
];

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const createSegmentId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `segment-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;

const normalizeDuration = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
};

const normalizeUpdatedAtMs = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
};

const isSegmentType = (value: unknown): value is SegmentType =>
  value === 'live' || value === 'pretape' || value === 'intermission';

const normalizeTimeInput = (value: unknown) => {
  if (typeof value !== 'string') {
    return DEFAULT_SHOW_START_TIME;
  }

  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return DEFAULT_SHOW_START_TIME;
  }

  const hours = clampNumber(Number.parseInt(match[1], 10), 0, 23);
  const minutes = clampNumber(Number.parseInt(match[2], 10), 0, 59);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const makeDefaultSetupState = (): PersistedSetupState => ({
  showStartTime: DEFAULT_SHOW_START_TIME,
  segments: DEFAULT_SEGMENTS.map((segment) => ({ ...segment })),
  updatedAtMs: 0,
});

const sanitizeSegments = (raw: unknown): Segment[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }

      const candidate = item as Record<string, unknown>;
      const id =
        typeof candidate.id === 'string' && candidate.id.trim().length > 0
          ? candidate.id
          : createSegmentId();
      const title = typeof candidate.title === 'string' ? candidate.title : 'Untitled Segment';
      const presenter = typeof candidate.presenter === 'string' ? candidate.presenter : '';
      const type = isSegmentType(candidate.type) ? candidate.type : 'live';
      const durationSec = normalizeDuration(candidate.durationSec);

      return {
        id,
        title,
        presenter,
        type,
        durationSec,
      };
    })
    .filter((segment): segment is Segment => segment !== null);
};

const sanitizeSetupState = (
  raw: Partial<PersistedSetupState> | Record<string, unknown>,
  fallback: PersistedSetupState
): PersistedSetupState => {
  const showStartTime = normalizeTimeInput(raw.showStartTime);
  const segments = sanitizeSegments(raw.segments);
  const updatedAtMs = normalizeUpdatedAtMs(raw.updatedAtMs);
  return {
    showStartTime,
    segments: segments.length > 0 ? segments : fallback.segments,
    updatedAtMs,
  };
};

const readCloudSetupState = (
  raw: Record<string, unknown>,
  fallback: PersistedSetupState
): PersistedSetupState => {
  const localShape = sanitizeSetupState(raw, fallback);
  if (localShape.updatedAtMs > 0) {
    return localShape;
  }

  const timestampCandidate = raw.updatedAt;
  if (
    typeof timestampCandidate === 'object' &&
    timestampCandidate !== null &&
    'toMillis' in timestampCandidate &&
    typeof timestampCandidate.toMillis === 'function'
  ) {
    return {
      ...localShape,
      updatedAtMs: normalizeUpdatedAtMs(timestampCandidate.toMillis()),
    };
  }

  return localShape;
};

const createSetupSignature = (state: PersistedSetupState) => JSON.stringify(state);

const toCloudSetupPayload = (state: PersistedSetupState) => ({
  showStartTime: state.showStartTime,
  segments: state.segments,
  updatedAtMs: state.updatedAtMs,
});

const getCloudSyncErrorMessage = (error: unknown) => {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    if (error.code === 'permission-denied') {
      return 'permission denied (update Firestore rules)';
    }
    if (error.code === 'unauthenticated') {
      return 'authentication required (check Firestore rules)';
    }
    return `error ${error.code}`;
  }
  return 'unavailable (local save still active)';
};

const readSetupState = (): PersistedSetupState => {
  const fallback = makeDefaultSetupState();
  if (typeof window === 'undefined') {
    return fallback;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSetupState>;
    const hydrated = sanitizeSetupState(parsed, fallback);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
    return hydrated;
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    return fallback;
  }
};

const writeSetupState = (state: PersistedSetupState) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // If storage is full or unavailable, fail silently so the timer still runs.
  }
};

const parseTimeInput = (timeInput: string) => {
  const normalized = normalizeTimeInput(timeInput);
  const [hoursRaw, minutesRaw] = normalized.split(':');
  const hours = Number.parseInt(hoursRaw, 10);
  const minutes = Number.parseInt(minutesRaw, 10);
  return { hours, minutes };
};

const buildScheduleOffsetsSec = (segments: Segment[]) => {
  let runningTotal = 0;
  return segments.map((segment) => {
    const currentOffset = runningTotal;
    runningTotal += segment.durationSec;
    return currentOffset;
  });
};

const buildAnchorTimestamp = (timeInput: string, referenceMs: number) => {
  const anchor = new Date(referenceMs);
  const { hours, minutes } = parseTimeInput(timeInput);
  anchor.setHours(hours, minutes, 0, 0);
  return anchor.getTime();
};

const formatClockTimestamp = (timestampMs: number, includeSeconds = false) => {
  const date = new Date(timestampMs);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const minuteLabel = String(minutes).padStart(2, '0');
  if (!includeSeconds) {
    return `${hours}:${minuteLabel} ${suffix}`;
  }

  const secondLabel = String(seconds).padStart(2, '0');
  return `${hours}:${minuteLabel}:${secondLabel} ${suffix}`;
};

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const getCountdownDisplay = (remainingSec: number) => {
  if (remainingSec > 180) {
    return String(Math.max(0, Math.floor(remainingSec / 60)));
  }

  const snapped = Math.max(0, Math.floor(remainingSec / 15) * 15);
  return formatDuration(snapped);
};

const getDurationLabel = (durationSec: number) => {
  const minutes = Math.floor(durationSec / 60);
  const seconds = durationSec % 60;
  if (seconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${seconds}s`;
};

const pluralize = (value: number, singular: string, plural: string) =>
  value === 1 ? singular : plural;

const formatAheadBehindDistance = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} ${pluralize(minutes, 'min', 'mins')}`;
  }

  const hours = Math.floor(minutes / 60);
  const leftoverMinutes = minutes % 60;
  if (leftoverMinutes === 0) {
    return `${hours} ${pluralize(hours, 'hr', 'hrs')}`;
  }

  return `${hours} ${pluralize(hours, 'hr', 'hrs')} ${leftoverMinutes}m`;
};

const upsertMetaTag = (name: string, content: string) => {
  const selector = `meta[name="${name}"]`;
  const existing = document.head.querySelector(selector) as HTMLMetaElement | null;

  if (existing) {
    const previousContent = existing.getAttribute('content');
    existing.setAttribute('content', content);
    return () => {
      if (previousContent === null) {
        existing.removeAttribute('content');
      } else {
        existing.setAttribute('content', previousContent);
      }
    };
  }

  const created = document.createElement('meta');
  created.setAttribute('name', name);
  created.setAttribute('content', content);
  document.head.appendChild(created);

  return () => {
    created.remove();
  };
};

const settleTimeBank = (bankBeforeSec: number, allocatedSec: number, elapsedSec: number) => {
  const safeBank = Math.max(0, Math.floor(bankBeforeSec));
  const safeAllocated = Math.max(0, Math.floor(allocatedSec));
  const safeElapsed = Math.max(0, Math.floor(elapsedSec));

  if (safeElapsed <= safeAllocated) {
    const gainedSec = safeAllocated - safeElapsed;
    return {
      bankAfterSec: safeBank + gainedSec,
      gainedSec,
      borrowedSec: 0,
      unbankedOvertimeSec: 0,
    };
  }

  const overtimeSec = safeElapsed - safeAllocated;
  const segmentCapSec = Math.min(safeBank, MAX_BONUS_PER_SEGMENT_SEC);
  const borrowedSec = Math.min(overtimeSec, segmentCapSec);
  const bankAfterSec = Math.max(0, safeBank - borrowedSec);
  const unbankedOvertimeSec = Math.max(0, overtimeSec - borrowedSec);

  return {
    bankAfterSec,
    gainedSec: 0,
    borrowedSec,
    unbankedOvertimeSec,
  };
};

const SortableSegmentRow = ({
  segment,
  index,
  scheduledStartLabel,
  onPatchSegment,
  onDeleteSegment,
  onDurationMinutesChange,
  onDurationSecondsChange,
  onNudgeDuration,
}: SortableSegmentRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segment.id,
  });
  const durationMinutes = Math.floor(segment.durationSec / 60);
  const durationSeconds = segment.durationSec % 60;

  return (
    <article
      ref={setNodeRef}
      className={`backstage-row ${isDragging ? 'is-dragging' : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <button
        type="button"
        className="backstage-drag-handle"
        aria-label={`Reorder segment ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        ☰
      </button>

      <div className="backstage-row-main">
        <div className="backstage-row-top">
          <span className="backstage-row-index">#{index + 1}</span>
          <span className="backstage-row-time">{scheduledStartLabel}</span>
          <span className="backstage-row-duration">{getDurationLabel(segment.durationSec)}</span>
        </div>

        <div className="backstage-row-fields">
          <input
            type="text"
            value={segment.title}
            onChange={(event) => onPatchSegment(segment.id, { title: event.target.value })}
            placeholder="Segment title"
            className="backstage-input"
          />
          <input
            type="text"
            value={segment.presenter}
            onChange={(event) => onPatchSegment(segment.id, { presenter: event.target.value })}
            placeholder="Presenter"
            className="backstage-input"
          />
          <select
            value={segment.type}
            onChange={(event) =>
              onPatchSegment(segment.id, { type: event.target.value as SegmentType })
            }
            className="backstage-select"
          >
            {SEGMENT_TYPES.map((type) => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
          <div className="backstage-duration-editor">
            <button
              type="button"
              className="backstage-nudge-btn"
              onClick={() => onNudgeDuration(segment.id, -15)}
            >
              -15s
            </button>
            <input
              type="number"
              min={0}
              value={durationMinutes}
              onChange={(event) =>
                onDurationMinutesChange(segment.id, Number.parseInt(event.target.value, 10))
              }
              className="backstage-duration-number"
              aria-label="Duration minutes"
            />
            <span className="backstage-colon">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={durationSeconds}
              onChange={(event) =>
                onDurationSecondsChange(segment.id, Number.parseInt(event.target.value, 10))
              }
              className="backstage-duration-number"
              aria-label="Duration seconds"
            />
            <button
              type="button"
              className="backstage-nudge-btn"
              onClick={() => onNudgeDuration(segment.id, 15)}
            >
              +15s
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="backstage-delete-btn"
        onClick={() => onDeleteSegment(segment.id)}
      >
        Delete
      </button>
    </article>
  );
};

const BACKSTAGE_STYLES = String.raw`
.backstage-page {
  --bg: #050505;
  --panel: #101010;
  --panel-2: #161616;
  --border: #2a2a2a;
  --text: #f4f4f4;
  --text-dim: #b2b2b2;
  --accent: #d4af37;
  --green: #18a957;
  --yellow: #d8b229;
  --red: #d34747;
  --control-bg: rgba(25, 25, 25, 0.72);
  color: var(--text);
  font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.backstage-page * {
  box-sizing: border-box;
}

.backstage-setup {
  min-height: 100dvh;
  background: radial-gradient(circle at top, #111 0%, #050505 45%, #020202 100%);
  padding: 1.2rem;
}

.backstage-setup-shell {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.backstage-setup-header {
  padding: 1rem 1.1rem;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(16, 16, 16, 0.9);
}

.backstage-setup-header h1 {
  color: var(--text);
  margin: 0 0 0.4rem;
  font-size: clamp(1.5rem, 3.3vw, 2.3rem);
  font-weight: 700;
  letter-spacing: 0.01em;
}

.backstage-setup-header p {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.95rem;
}

.backstage-settings {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel);
  padding: 1rem;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.8rem 1rem;
  align-items: end;
}

.backstage-time-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.backstage-time-group label {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-family: inherit;
}

.backstage-time-group input {
  width: 180px;
  max-width: 100%;
  background: #151515;
  border: 1px solid #353535;
  border-radius: 10px;
  color: var(--text);
  padding: 0.7rem 0.85rem;
  font-size: 1rem;
}

.backstage-total-runtime {
  color: var(--text-dim);
  font-size: 0.92rem;
}

.backstage-cloud-sync {
  margin-top: 0.2rem;
  font-size: 0.82rem;
  color: #a6a6a6;
}

.backstage-cloud-sync.syncing {
  color: #d8b229;
}

.backstage-cloud-sync.synced {
  color: #79d29f;
}

.backstage-cloud-sync.error {
  color: #e18484;
}

.backstage-settings-actions {
  display: flex;
  gap: 0.6rem;
  justify-self: end;
  align-self: center;
}

.backstage-btn {
  border: 1px solid #3f3f3f;
  border-radius: 10px;
  background: #1a1a1a;
  color: var(--text);
  padding: 0.7rem 0.95rem;
  font-size: 0.92rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, background-color 120ms ease, border-color 120ms ease;
}

.backstage-btn:hover {
  transform: translateY(-1px);
  background: #222;
  border-color: #555;
}

.backstage-btn-start {
  border-color: #1f9f59;
  background: #137640;
  color: #fff;
  padding-inline: 1.25rem;
  font-size: 1rem;
}

.backstage-btn-start:hover {
  border-color: #28b466;
  background: #17924f;
}

.backstage-btn:disabled,
.backstage-btn-start:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.backstage-rundown {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--panel);
  padding: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.backstage-rundown-empty {
  border: 1px dashed #3a3a3a;
  border-radius: 12px;
  padding: 1.2rem;
  text-align: center;
  color: var(--text-dim);
}

.backstage-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0.7rem;
  align-items: center;
  border: 1px solid #2d2d2d;
  border-radius: 12px;
  background: #141414;
  padding: 0.7rem;
}

.backstage-row.is-dragging {
  opacity: 0.75;
  border-color: #5f5f5f;
}

.backstage-drag-handle {
  border: 1px solid #3a3a3a;
  border-radius: 10px;
  background: #1b1b1b;
  color: #ddd;
  width: 2.2rem;
  height: 2.2rem;
  font-size: 1.1rem;
  cursor: grab;
  touch-action: none;
}

.backstage-drag-handle:active {
  cursor: grabbing;
}

.backstage-row-main {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.backstage-row-top {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.backstage-row-index,
.backstage-row-time,
.backstage-row-duration {
  border: 1px solid #363636;
  border-radius: 999px;
  padding: 0.16rem 0.52rem;
  font-size: 0.76rem;
  line-height: 1.35;
  color: #d5d5d5;
}

.backstage-row-time {
  color: #f0f0f0;
}

.backstage-row-fields {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto auto;
  gap: 0.55rem;
}

.backstage-input,
.backstage-select,
.backstage-duration-number {
  border: 1px solid #393939;
  background: #1b1b1b;
  border-radius: 10px;
  color: var(--text);
  padding: 0.58rem 0.66rem;
  font-size: 0.92rem;
  width: 100%;
}

.backstage-input:focus,
.backstage-select:focus,
.backstage-duration-number:focus {
  outline: none;
  border-color: #6a6a6a;
  box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.17);
}

.backstage-duration-editor {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.backstage-duration-number {
  width: 4.1rem;
  text-align: center;
}

.backstage-colon {
  color: #b8b8b8;
  font-size: 0.92rem;
}

.backstage-nudge-btn {
  border: 1px solid #3c3c3c;
  background: #202020;
  color: #ddd;
  border-radius: 9px;
  padding: 0.45rem 0.52rem;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.backstage-delete-btn {
  border: 1px solid #5a3030;
  border-radius: 10px;
  background: #311818;
  color: #f0d9d9;
  padding: 0.6rem 0.7rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.backstage-bottom-actions {
  display: flex;
  gap: 0.65rem;
}

.backstage-presentation {
  position: fixed;
  inset: 0;
  background: #000;
  color: #fff;
  overflow: hidden;
  touch-action: manipulation;
  animation: backstageFadeIn 220ms ease;
}

.backstage-stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: calc(1rem + env(safe-area-inset-top)) 1.2rem calc(7.9rem + env(safe-area-inset-bottom));
}

.backstage-stage-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  border: 1px solid #141414;
  background: linear-gradient(180deg, #080808 0%, #040404 70%, #030303 100%);
  animation: backstageSegmentIn 220ms ease;
  padding: 1.4rem;
  gap: 1rem;
}

.backstage-segment-counter {
  align-self: flex-end;
  border: 1px solid #2a2a2a;
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.82rem;
  color: #d0d0d0;
}

.backstage-live-header {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.backstage-type-pill {
  display: inline-flex;
  align-self: flex-start;
  border-radius: 999px;
  padding: 0.22rem 0.62rem;
  border: 1px solid #303030;
  color: #d8d8d8;
  font-size: 0.73rem;
  letter-spacing: 0.08em;
  font-weight: 700;
  text-transform: uppercase;
}

.backstage-presenter {
  margin: 0;
  color: #e8e8e8;
  font-weight: 600;
  font-size: clamp(1.1rem, 2.8vw, 2.25rem);
}

.backstage-live-title {
  margin: 0;
  color: #f7f7f7;
  font-size: clamp(1.5rem, 5vw, 3.8rem);
  line-height: 1.1;
  letter-spacing: 0.01em;
  font-weight: 700;
}

.backstage-countdown-wrap {
  margin: auto 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.backstage-countdown {
  margin: 0;
  font-size: clamp(7.4rem, 27vw, 21rem);
  line-height: 0.92;
  font-weight: 800;
  letter-spacing: 0.02em;
  text-align: center;
  color: #fff;
  text-shadow: 0 4px 28px rgba(255, 255, 255, 0.08);
}

.backstage-countdown.bonus {
  color: #eac24d;
  text-shadow: 0 4px 26px rgba(234, 194, 77, 0.22);
}

.backstage-countdown.over {
  color: #ff5959;
  text-shadow: 0 4px 26px rgba(255, 89, 89, 0.26);
}

.backstage-countdown-sub {
  font-size: clamp(1rem, 2.2vw, 1.65rem);
  color: #cdcdcd;
  letter-spacing: 0.02em;
  text-align: center;
}

.backstage-progress-shell {
  margin-top: auto;
}

.backstage-progress-track {
  position: relative;
  width: min(1200px, 100%);
  height: 24px;
  margin: 0 auto;
  border-radius: 999px;
  border: 1px solid #2e2e2e;
  overflow: hidden;
  background: #101010;
}

.backstage-progress-zone {
  position: absolute;
  top: 0;
  bottom: 0;
}

.backstage-progress-zone.green {
  left: 0;
  width: 60%;
  background: linear-gradient(90deg, #0f8442 0%, #18a957 100%);
}

.backstage-progress-zone.yellow {
  left: 60%;
  width: 25%;
  background: linear-gradient(90deg, #c7991f 0%, #ddb933 100%);
}

.backstage-progress-zone.red {
  left: 85%;
  width: 15%;
  background: linear-gradient(90deg, #bd3939 0%, #d24d4d 100%);
}

.backstage-progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.3);
  box-shadow: inset -7px 0 8px rgba(255, 255, 255, 0.15);
  transition: width 220ms linear;
}

.backstage-progress-marker {
  position: absolute;
  top: 50%;
  width: 26px;
  height: 26px;
  transform: translate(-50%, -50%);
  border-radius: 999px;
  background: #fff;
  border: 3px solid #101010;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35), 0 5px 18px rgba(0, 0, 0, 0.55);
  transition: left 220ms linear;
}

.backstage-pretape-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
}

.backstage-pretape-kind {
  margin: 0;
  color: #a0a0a0;
  font-size: clamp(0.95rem, 1.8vw, 1.35rem);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
}

.backstage-pretape-title {
  margin: 0;
  color: #fff;
  font-size: clamp(2.2rem, 8vw, 6.2rem);
  line-height: 1.06;
  letter-spacing: 0.01em;
}

.backstage-pretape-elapsed {
  margin: 0;
  color: #bababa;
  font-size: clamp(1rem, 2vw, 1.5rem);
}

.backstage-complete-btn {
  margin-top: 0.45rem;
  border: 1px solid #5a5a5a;
  background: #1f1f1f;
  border-radius: 14px;
  color: #fff;
  font-size: clamp(1.5rem, 4.4vw, 2.5rem);
  font-weight: 700;
  padding: 1.05rem 1.7rem;
  min-width: min(560px, 90%);
  cursor: pointer;
}

.backstage-control-bar {
  position: absolute;
  left: 50%;
  bottom: calc(0.7rem + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: min(860px, calc(100% - 1.8rem));
  border: 1px solid #343434;
  border-radius: 16px;
  background: var(--control-bg);
  backdrop-filter: blur(10px);
  padding: 0.6rem;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.backstage-control-btn {
  border: 1px solid #464646;
  border-radius: 12px;
  background: #202020;
  color: #fff;
  min-height: 64px;
  font-size: clamp(1rem, 2.2vw, 1.35rem);
  font-weight: 700;
  cursor: pointer;
}

.backstage-control-btn.primary {
  border-color: #2fa760;
  background: #167a43;
}

.backstage-control-btn:disabled {
  opacity: 0.46;
  cursor: not-allowed;
}

.backstage-rundown-handle {
  position: absolute;
  left: 0;
  top: 48%;
  transform: translateY(-50%);
  z-index: 30;
  border: 1px solid #353535;
  border-left: 0;
  border-radius: 0 10px 10px 0;
  background: rgba(18, 18, 18, 0.9);
  color: #e8e8e8;
  width: 34px;
  height: 92px;
  cursor: pointer;
  font-size: 1.1rem;
}

.backstage-drawer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 25;
  width: min(390px, calc(100% - 40px));
  border-right: 1px solid #2f2f2f;
  background: rgba(9, 9, 9, 0.95);
  backdrop-filter: blur(14px);
  transform: translateX(-100%);
  transition: transform 220ms ease;
  display: flex;
  flex-direction: column;
}

.backstage-drawer.open {
  transform: translateX(0);
}

.backstage-drawer-header {
  padding: 0.95rem;
  border-bottom: 1px solid #292929;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.backstage-drawer-title {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #d2d2d2;
  font-weight: 700;
}

.backstage-drift-pill,
.backstage-bank-pill {
  border-radius: 10px;
  border: 1px solid #3b3b3b;
  padding: 0.5rem 0.62rem;
  font-size: 0.92rem;
  font-weight: 700;
}

.backstage-drift-pill.ahead {
  border-color: #1f8747;
  background: rgba(24, 169, 87, 0.18);
  color: #64e79a;
}

.backstage-drift-pill.behind {
  border-color: #9d3232;
  background: rgba(211, 71, 71, 0.2);
  color: #ff8d8d;
}

.backstage-drift-pill.neutral {
  border-color: #666;
  background: rgba(160, 160, 160, 0.16);
  color: #dadada;
}

.backstage-bank-pill {
  color: #f4e5b0;
  border-color: #806d36;
  background: rgba(153, 126, 51, 0.16);
}

.backstage-timing-handle {
  position: absolute;
  right: 0;
  top: 48%;
  transform: translateY(-50%);
  z-index: 30;
  border: 1px solid #353535;
  border-right: 0;
  border-radius: 10px 0 0 10px;
  background: rgba(18, 18, 18, 0.9);
  color: #e8e8e8;
  width: 34px;
  height: 92px;
  cursor: pointer;
  font-size: 1.1rem;
}

.backstage-timing-drawer {
  position: absolute;
  right: 0;
  top: 0;
  z-index: 25;
  width: min(270px, calc(100% - 40px));
  border-left: 1px solid #2f2f2f;
  border-bottom: 1px solid #2f2f2f;
  border-radius: 0 0 0 14px;
  background: rgba(9, 9, 9, 0.95);
  backdrop-filter: blur(14px);
  transform: translateX(100%);
  transition: transform 220ms ease;
  display: flex;
  flex-direction: column;
}

.backstage-timing-drawer.open {
  transform: translateX(0);
}

.backstage-timing-header {
  padding: 0.9rem 0.9rem 0.7rem;
  border-bottom: 1px solid #292929;
}

.backstage-timing-title {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #c8c8c8;
  font-weight: 700;
}

.backstage-timing-body {
  padding: 0.8rem 0.9rem;
  display: flex;
  flex-direction: column;
}

.backstage-timing-main {
  margin: 0;
  border: 1px solid #3b3b3b;
  border-radius: 12px;
  padding: 1rem 0.9rem;
  text-align: center;
  font-size: 1.3rem;
  line-height: 1.3;
  font-weight: 800;
  letter-spacing: 0.01em;
}

.backstage-timing-main.ahead {
  border-color: #1f8747;
  background: rgba(24, 169, 87, 0.18);
  color: #64e79a;
}

.backstage-timing-main.behind {
  border-color: #9d3232;
  background: rgba(211, 71, 71, 0.2);
  color: #ff8d8d;
}

.backstage-timing-main.neutral {
  border-color: #666;
  background: rgba(160, 160, 160, 0.16);
  color: #dadada;
}

.backstage-drawer-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.65rem 0.72rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.backstage-drawer-row {
  border: 1px solid #2a2a2a;
  border-radius: 9px;
  padding: 0.48rem 0.52rem;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  background: rgba(20, 20, 20, 0.92);
}

.backstage-drawer-row.current {
  border-color: #d4af37;
  background: rgba(212, 175, 55, 0.11);
}

.backstage-drawer-row.past {
  opacity: 0.53;
}

.backstage-drawer-row-top {
  display: flex;
  gap: 0.44rem;
  font-size: 0.88rem;
  font-weight: 700;
}

.backstage-drawer-row-bottom {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  font-size: 0.73rem;
  color: #c2c2c2;
}

.backstage-drawer-footer {
  border-top: 1px solid #282828;
  padding: 0.75rem;
}

.backstage-back-to-setup {
  border: 1px solid #474747;
  border-radius: 10px;
  background: #181818;
  color: #d7d7d7;
  width: 100%;
  padding: 0.62rem 0.72rem;
  font-size: 0.84rem;
  cursor: pointer;
}

.backstage-empty-presentation {
  height: 100%;
  width: 100%;
  display: grid;
  place-items: center;
  text-align: center;
  gap: 0.8rem;
}

.backstage-loading {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  color: #ddd;
  background: #070707;
}

@keyframes backstageFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes backstageSegmentIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 980px) {
  .backstage-row-fields {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .backstage-settings {
    grid-template-columns: 1fr;
  }

  .backstage-settings-actions {
    justify-self: start;
  }
}
`;

const BackstageTimer = () => {
  const [mode, setMode] = useState<Mode>('setup');
  const [showStartTime, setShowStartTime] = useState(DEFAULT_SHOW_START_TIME);
  const [segments, setSegments] = useState<Segment[]>(DEFAULT_SEGMENTS);
  const [setupUpdatedAtMs, setSetupUpdatedAtMs] = useState(0);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>(
    'idle'
  );
  const [cloudSyncErrorMessage, setCloudSyncErrorMessage] = useState<string | null>(null);

  const [showStartedAtMs, setShowStartedAtMs] = useState<number | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [timeBankSec, setTimeBankSec] = useState(0);
  const [segmentBankAtStartSec, setSegmentBankAtStartSec] = useState(0);
  const [completedRuns, setCompletedRuns] = useState<CompletedRun[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [segmentElapsedBaseMs, setSegmentElapsedBaseMs] = useState(0);
  const [segmentRunStartMs, setSegmentRunStartMs] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rundownDrawerOpen, setRundownDrawerOpen] = useState(false);
  const [timingDrawerOpen, setTimingDrawerOpen] = useState(false);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const cloudBootstrapStartedRef = useRef(false);
  const cloudBootstrapCompleteRef = useRef(false);
  const skipNextCloudWriteRef = useRef(false);
  const lastSyncedCloudSignatureRef = useRef('');
  const cloudDocRef = useMemo(
    () => doc(db, RUN_OF_SHOW_COLLECTION, RUN_OF_SHOW_DOC_ID),
    []
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );
  const currentSetupState = useMemo<PersistedSetupState>(
    () => ({
      showStartTime,
      segments,
      updatedAtMs: setupUpdatedAtMs,
    }),
    [segments, setupUpdatedAtMs, showStartTime]
  );
  const currentSetupSignature = useMemo(
    () => createSetupSignature(currentSetupState),
    [currentSetupState]
  );
  const cloudSyncLabel = useMemo(() => {
    if (cloudSyncState === 'syncing') {
      return 'Cloud sync: syncing...';
    }
    if (cloudSyncState === 'error') {
      if (cloudSyncErrorMessage) {
        return `Cloud sync: ${cloudSyncErrorMessage}`;
      }
      return 'Cloud sync: unavailable (local save still active)';
    }
    if (cloudSyncState === 'synced') {
      return 'Cloud sync: up to date';
    }
    return 'Cloud sync: connecting...';
  }, [cloudSyncErrorMessage, cloudSyncState]);

  const scheduleOffsetsSec = useMemo(() => buildScheduleOffsetsSec(segments), [segments]);
  const totalPlannedSec = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.durationSec, 0),
    [segments]
  );
  const setupScheduleAnchorMs = useMemo(
    () => buildAnchorTimestamp(showStartTime, Date.now()),
    [showStartTime]
  );

  const currentSegment = segments[currentSegmentIndex] ?? null;

  const currentElapsedMs = useMemo(() => {
    const runningMs = segmentRunStartMs === null ? 0 : nowMs - segmentRunStartMs;
    return Math.max(0, segmentElapsedBaseMs + runningMs);
  }, [nowMs, segmentElapsedBaseMs, segmentRunStartMs]);
  const currentElapsedSec = currentElapsedMs / 1000;

  const scheduleAnchorMs = useMemo(
    () => buildAnchorTimestamp(showStartTime, showStartedAtMs ?? nowMs),
    [showStartTime, showStartedAtMs, nowMs]
  );
  const currentOffsetSec = scheduleOffsetsSec[currentSegmentIndex] ?? 0;
  const currentScheduledStartMs = scheduleAnchorMs + currentOffsetSec * 1000;
  const driftMs = mode === 'presentation' ? nowMs - currentScheduledStartMs : 0;

  const driftBadge = useMemo(() => {
    const absMs = Math.abs(driftMs);
    if (absMs < 30_000) {
      return {
        tone: 'neutral' as const,
        text: 'On schedule',
      };
    }

    const wholeMinutes = Math.max(1, Math.round(absMs / 60_000));
    const formattedDistance = formatAheadBehindDistance(wholeMinutes);
    if (driftMs < 0) {
      return {
        tone: 'ahead' as const,
        text: `▲ ${formattedDistance} ahead`,
      };
    }
    return {
      tone: 'behind' as const,
      text: `▼ ${formattedDistance} behind`,
    };
  }, [driftMs]);

  const projectedScheduleMs = useMemo(
    () =>
      scheduleOffsetsSec.map((offsetSec) => {
        const scheduledStartMs = scheduleAnchorMs + offsetSec * 1000;
        return scheduledStartMs + driftMs;
      }),
    [driftMs, scheduleAnchorMs, scheduleOffsetsSec]
  );

  const countdownState = useMemo(() => {
    if (!currentSegment || currentSegment.type === 'pretape') {
      return null;
    }

    const remainingSec = currentSegment.durationSec - currentElapsedSec;
    if (remainingSec > 0) {
      return {
        primary: getCountdownDisplay(remainingSec),
        secondary: `${formatDuration(Math.ceil(remainingSec))} remaining`,
        tone: 'normal' as const,
      };
    }

    const overtimeSec = Math.max(0, -remainingSec);
    const bonusCapSec = Math.min(segmentBankAtStartSec, MAX_BONUS_PER_SEGMENT_SEC);
    const bonusRemainingSec = Math.max(0, bonusCapSec - overtimeSec);

    if (bonusRemainingSec > 0) {
      return {
        primary: formatDuration(Math.ceil(bonusRemainingSec)),
        secondary: `BONUS +${formatDuration(Math.floor(overtimeSec))} / ${formatDuration(
          bonusCapSec
        )} available`,
        tone: 'bonus' as const,
      };
    }

    return {
      primary: `+${formatDuration(Math.floor(overtimeSec))}`,
      secondary: 'OVER',
      tone: 'over' as const,
    };
  }, [currentElapsedSec, currentSegment, segmentBankAtStartSec]);

  const progressRatio = useMemo(() => {
    if (!currentSegment || currentSegment.type === 'pretape') {
      return 0;
    }
    if (currentSegment.durationSec <= 0) {
      return 1;
    }
    return clampNumber(currentElapsedSec / currentSegment.durationSec, 0, 1);
  }, [currentElapsedSec, currentSegment]);

  const requestFullscreen = useCallback(async () => {
    const root = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };

    try {
      if (document.fullscreenElement) {
        return;
      }
      if (typeof root.requestFullscreen === 'function') {
        await root.requestFullscreen();
      } else if (typeof root.webkitRequestFullscreen === 'function') {
        root.webkitRequestFullscreen();
      }
    } catch {
      // iPad Safari may not support fullscreen API; app still works as A2HS web app.
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    const currentWakeLock = wakeLockRef.current;
    if (!currentWakeLock) {
      return;
    }

    try {
      await currentWakeLock.release();
    } catch {
      // Ignore release failures.
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) {
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen');
      wakeLockRef.current = sentinel;
      sentinel.addEventListener?.('release', () => {
        if (wakeLockRef.current === sentinel) {
          wakeLockRef.current = null;
        }
      });
    } catch {
      // Permission denied or unsupported context. Continue without wake lock.
    }
  }, []);

  const markSetupChanged = useCallback(() => {
    setSetupUpdatedAtMs(Date.now());
  }, []);

  const handleShowStartTimeChange = useCallback(
    (nextValue: string) => {
      setShowStartTime(normalizeTimeInput(nextValue));
      markSetupChanged();
    },
    [markSetupChanged]
  );

  const patchSegment = useCallback((segmentId: string, patch: Partial<Segment>) => {
    setSegments((previous) =>
      previous.map((segment) => (segment.id === segmentId ? { ...segment, ...patch } : segment))
    );
    markSetupChanged();
  }, [markSetupChanged]);

  const deleteSegment = useCallback((segmentId: string) => {
    setSegments((previous) => previous.filter((segment) => segment.id !== segmentId));
    markSetupChanged();
  }, [markSetupChanged]);

  const setDurationMinutes = useCallback((segmentId: string, minutes: number) => {
    const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0;
    setSegments((previous) =>
      previous.map((segment) => {
        if (segment.id !== segmentId) {
          return segment;
        }
        const safeSecondsPart = segment.durationSec % 60;
        return {
          ...segment,
          durationSec: safeMinutes * 60 + safeSecondsPart,
        };
      })
    );
    markSetupChanged();
  }, [markSetupChanged]);

  const setDurationSeconds = useCallback((segmentId: string, seconds: number) => {
    const safeSeconds = Number.isFinite(seconds)
      ? clampNumber(Math.floor(seconds), 0, 59)
      : 0;
    setSegments((previous) =>
      previous.map((segment) => {
        if (segment.id !== segmentId) {
          return segment;
        }
        const safeMinutePart = Math.floor(segment.durationSec / 60);
        return {
          ...segment,
          durationSec: safeMinutePart * 60 + safeSeconds,
        };
      })
    );
    markSetupChanged();
  }, [markSetupChanged]);

  const nudgeDuration = useCallback((segmentId: string, deltaSec: number) => {
    setSegments((previous) =>
      previous.map((segment) => {
        if (segment.id !== segmentId) {
          return segment;
        }
        return {
          ...segment,
          durationSec: Math.max(0, segment.durationSec + deltaSec),
        };
      })
    );
    markSetupChanged();
  }, [markSetupChanged]);

  const addSegment = useCallback(() => {
    setSegments((previous) => [
      ...previous,
      {
        id: createSegmentId(),
        title: `New Segment ${previous.length + 1}`,
        presenter: '',
        type: 'live',
        durationSec: 5 * 60,
      },
    ]);
    markSetupChanged();
  }, [markSetupChanged]);

  const resetToDefaults = useCallback(() => {
    const defaults = makeDefaultSetupState();
    setShowStartTime(defaults.showStartTime);
    setSegments(defaults.segments);
    markSetupChanged();
  }, [markSetupChanged]);

  const startShow = useCallback(() => {
    if (segments.length === 0) {
      return;
    }

    const startMs = Date.now();
    void requestFullscreen();
    setMode('presentation');
    setShowStartedAtMs(startMs);
    setCurrentSegmentIndex(0);
    setTimeBankSec(0);
    setSegmentBankAtStartSec(0);
    setCompletedRuns([]);
    setIsPaused(false);
    setSegmentElapsedBaseMs(0);
    setSegmentRunStartMs(startMs);
    setNowMs(startMs);
    setRundownDrawerOpen(false);
    setTimingDrawerOpen(false);
  }, [requestFullscreen, segments.length]);

  const backToSetup = useCallback(() => {
    setMode('setup');
    setRundownDrawerOpen(false);
    setTimingDrawerOpen(false);
    setIsPaused(true);
    setSegmentRunStartMs(null);
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      void document.exitFullscreen();
    }
  }, []);

  const toggleRundownDrawer = useCallback(() => {
    setRundownDrawerOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen) {
        setTimingDrawerOpen(false);
      }
      return willOpen;
    });
  }, []);

  const toggleTimingDrawer = useCallback(() => {
    setTimingDrawerOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen) {
        setRundownDrawerOpen(false);
      }
      return willOpen;
    });
  }, []);

  const togglePause = useCallback(() => {
    if (mode !== 'presentation' || !currentSegment) {
      return;
    }

    const stamp = Date.now();
    if (segmentRunStartMs === null) {
      setSegmentRunStartMs(stamp);
      setIsPaused(false);
    } else {
      setSegmentElapsedBaseMs((previous) => previous + (stamp - segmentRunStartMs));
      setSegmentRunStartMs(null);
      setIsPaused(true);
    }
    setNowMs(stamp);
  }, [currentSegment, mode, segmentRunStartMs]);

  const goToNextSegment = useCallback(() => {
    if (mode !== 'presentation' || !currentSegment) {
      return;
    }

    const elapsedWholeSec = Math.max(0, Math.round(currentElapsedMs / 1000));
    const settlement = settleTimeBank(
      segmentBankAtStartSec,
      currentSegment.durationSec,
      elapsedWholeSec
    );
    const run: CompletedRun = {
      segmentId: currentSegment.id,
      elapsedSec: elapsedWholeSec,
      bankBeforeSec: segmentBankAtStartSec,
      bankAfterSec: settlement.bankAfterSec,
    };

    setCompletedRuns((previous) => {
      const trimmed = previous.slice(0, currentSegmentIndex);
      trimmed.push(run);
      return trimmed;
    });
    setTimeBankSec(settlement.bankAfterSec);

    if (currentSegmentIndex >= segments.length - 1) {
      setSegmentBankAtStartSec(settlement.bankAfterSec);
      setSegmentElapsedBaseMs(currentElapsedMs);
      setSegmentRunStartMs(null);
      setIsPaused(true);
      return;
    }

    const nextStartMs = Date.now();
    setCurrentSegmentIndex(currentSegmentIndex + 1);
    setSegmentBankAtStartSec(settlement.bankAfterSec);
    setSegmentElapsedBaseMs(0);
    setSegmentRunStartMs(nextStartMs);
    setIsPaused(false);
    setNowMs(nextStartMs);
  }, [
    currentElapsedMs,
    currentSegment,
    currentSegmentIndex,
    mode,
    segmentBankAtStartSec,
    segments.length,
  ]);

  const goToPreviousSegment = useCallback(() => {
    if (mode !== 'presentation' || currentSegmentIndex === 0) {
      return;
    }

    const targetIndex = currentSegmentIndex - 1;
    const previousRun = completedRuns[targetIndex - 1];
    const restoredBankSec = targetIndex === 0 ? 0 : previousRun?.bankAfterSec ?? 0;
    const restartMs = Date.now();

    setCurrentSegmentIndex(targetIndex);
    setCompletedRuns((previous) => previous.slice(0, targetIndex));
    setTimeBankSec(restoredBankSec);
    setSegmentBankAtStartSec(restoredBankSec);
    setSegmentElapsedBaseMs(0);
    setSegmentRunStartMs(restartMs);
    setIsPaused(false);
    setNowMs(restartMs);
  }, [completedRuns, currentSegmentIndex, mode]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    if (!overId || activeId === overId) {
      return;
    }

    setSegments((previous) => {
      const oldIndex = previous.findIndex((segment) => segment.id === activeId);
      const newIndex = previous.findIndex((segment) => segment.id === overId);
      if (oldIndex < 0 || newIndex < 0) {
        return previous;
      }
      return arrayMove(previous, oldIndex, newIndex);
    });
    markSetupChanged();
  }, [markSetupChanged]);

  useEffect(() => {
    const persistedState = readSetupState();
    setShowStartTime(persistedState.showStartTime);
    setSegments(persistedState.segments);
    setSetupUpdatedAtMs(persistedState.updatedAtMs);
    setStorageHydrated(true);
  }, []);

  useEffect(() => {
    if (!storageHydrated) {
      return;
    }
    writeSetupState(currentSetupState);
  }, [currentSetupState, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || cloudBootstrapStartedRef.current) {
      return;
    }

    cloudBootstrapStartedRef.current = true;
    let cancelled = false;

    const bootstrapCloudSync = async () => {
      setCloudSyncState('syncing');
      setCloudSyncErrorMessage(null);
      try {
        const localState = currentSetupState;
        const localSignature = createSetupSignature(localState);
        const snapshot = await getDoc(cloudDocRef);
        if (cancelled) {
          return;
        }

        if (!snapshot.exists()) {
          await setDoc(cloudDocRef, toCloudSetupPayload(localState), { merge: true });
          if (cancelled) {
            return;
          }
          lastSyncedCloudSignatureRef.current = localSignature;
          cloudBootstrapCompleteRef.current = true;
          setCloudSyncState('synced');
          setCloudSyncErrorMessage(null);
          return;
        }

        const remoteData = snapshot.data();
        const remoteState = readCloudSetupState(remoteData, makeDefaultSetupState());
        const remoteSignature = createSetupSignature(remoteState);
        const remoteIsNewer = remoteState.updatedAtMs > localState.updatedAtMs;
        const localIsNewer = localState.updatedAtMs > remoteState.updatedAtMs;

        if (remoteIsNewer || (!localIsNewer && remoteSignature !== localSignature)) {
          skipNextCloudWriteRef.current = true;
          lastSyncedCloudSignatureRef.current = remoteSignature;
          setShowStartTime(remoteState.showStartTime);
          setSegments(remoteState.segments);
          setSetupUpdatedAtMs(remoteState.updatedAtMs);
          cloudBootstrapCompleteRef.current = true;
          setCloudSyncState('synced');
          setCloudSyncErrorMessage(null);
          return;
        }

        if (localSignature !== remoteSignature) {
          await setDoc(cloudDocRef, toCloudSetupPayload(localState), { merge: true });
          if (cancelled) {
            return;
          }
        }

        lastSyncedCloudSignatureRef.current = localSignature;
        cloudBootstrapCompleteRef.current = true;
        setCloudSyncState('synced');
        setCloudSyncErrorMessage(null);
      } catch (error) {
        console.error('Failed to sync run of show from cloud:', error);
        cloudBootstrapCompleteRef.current = true;
        setCloudSyncState('error');
        setCloudSyncErrorMessage(getCloudSyncErrorMessage(error));
      }
    };

    void bootstrapCloudSync();
    return () => {
      cancelled = true;
    };
  }, [cloudDocRef, currentSetupState, storageHydrated]);

  useEffect(() => {
    if (!storageHydrated || !cloudBootstrapCompleteRef.current) {
      return;
    }

    if (skipNextCloudWriteRef.current) {
      skipNextCloudWriteRef.current = false;
      return;
    }

    if (currentSetupSignature === lastSyncedCloudSignatureRef.current) {
      return;
    }

    setCloudSyncState('syncing');
    setCloudSyncErrorMessage(null);
    const pendingState = currentSetupState;
    const pendingSignature = currentSetupSignature;
    const timeoutId = window.setTimeout(() => {
      void setDoc(cloudDocRef, toCloudSetupPayload(pendingState), { merge: true })
        .then(() => {
          lastSyncedCloudSignatureRef.current = pendingSignature;
          setCloudSyncState('synced');
          setCloudSyncErrorMessage(null);
        })
        .catch((error) => {
          console.error('Failed to save run of show to cloud:', error);
          setCloudSyncState('error');
          setCloudSyncErrorMessage(getCloudSyncErrorMessage(error));
        });
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [cloudDocRef, currentSetupSignature, currentSetupState, storageHydrated]);

  useEffect(() => {
    const cleanups = [
      upsertMetaTag('apple-mobile-web-app-capable', 'yes'),
      upsertMetaTag('apple-mobile-web-app-status-bar-style', 'black-translucent'),
      upsertMetaTag('apple-mobile-web-app-title', 'Seanscars Timer'),
      upsertMetaTag('mobile-web-app-capable', 'yes'),
      upsertMetaTag('theme-color', '#000000'),
    ];
    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  useEffect(() => {
    if (mode !== 'presentation') {
      return undefined;
    }
    return upsertMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
    );
  }, [mode]);

  useEffect(() => {
    if (mode !== 'presentation') {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.style.touchAction = 'manipulation';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'presentation') {
      void releaseWakeLock();
      return undefined;
    }

    void requestWakeLock();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void releaseWakeLock();
    };
  }, [mode, releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    if (mode !== 'presentation') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'presentation') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextSegment();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPreviousSegment();
      } else if (event.key === ' ') {
        event.preventDefault();
        togglePause();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        backToSetup();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [backToSetup, goToNextSegment, goToPreviousSegment, mode, togglePause]);

  if (!storageHydrated) {
    return (
      <div className="backstage-page backstage-loading">
        <style>{BACKSTAGE_STYLES}</style>
        Loading stage timer...
      </div>
    );
  }

  if (mode === 'setup') {
    return (
      <div className="backstage-page backstage-setup">
        <style>{BACKSTAGE_STYLES}</style>
        <div className="backstage-setup-shell">
          <header className="backstage-setup-header">
            <h1>Seanscars Stage Timer</h1>
            <p>
              Edit title, presenter, duration, and type inline. Drag segments to reorder.
              Scheduled starts auto-cascade from the show start time. Defaults now load from
              your current run of show.
            </p>
          </header>

          <section className="backstage-settings">
            <div className="backstage-time-group">
              <label htmlFor="show-start-time">Show Start Time</label>
              <input
                id="show-start-time"
                type="time"
                value={showStartTime}
                step={60}
                onChange={(event) => handleShowStartTimeChange(event.target.value)}
              />
              <p className="backstage-total-runtime">
                Planned runtime: {formatDuration(totalPlannedSec)} ({segments.length}{' '}
                {pluralize(segments.length, 'segment', 'segments')})
              </p>
              <p className={`backstage-cloud-sync ${cloudSyncState}`}>{cloudSyncLabel}</p>
            </div>

            <div className="backstage-settings-actions">
              <button type="button" className="backstage-btn" onClick={resetToDefaults}>
                Reset to Defaults
              </button>
              <button
                type="button"
                className="backstage-btn backstage-btn-start"
                onClick={startShow}
                disabled={segments.length === 0}
              >
                Start Show
              </button>
            </div>
          </section>

          <section className="backstage-rundown">
            {segments.length === 0 ? (
              <div className="backstage-rundown-empty">
                No segments yet. Add one to begin building the rundown.
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={segments.map((segment) => segment.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {segments.map((segment, index) => (
                    <SortableSegmentRow
                      key={segment.id}
                      segment={segment}
                      index={index}
                      scheduledStartLabel={formatClockTimestamp(
                        setupScheduleAnchorMs + (scheduleOffsetsSec[index] ?? 0) * 1000,
                        true
                      )}
                      onPatchSegment={patchSegment}
                      onDeleteSegment={deleteSegment}
                      onDurationMinutesChange={setDurationMinutes}
                      onDurationSecondsChange={setDurationSeconds}
                      onNudgeDuration={nudgeDuration}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}

            <div className="backstage-bottom-actions">
              <button type="button" className="backstage-btn" onClick={addSegment}>
                + Add Segment
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="backstage-page backstage-presentation">
      <style>{BACKSTAGE_STYLES}</style>

      <button
        type="button"
        className="backstage-rundown-handle"
        onClick={toggleRundownDrawer}
        aria-label={rundownDrawerOpen ? 'Hide run of show' : 'Show run of show'}
      >
        {rundownDrawerOpen ? '◀' : '▶'}
      </button>

      <aside className={`backstage-drawer ${rundownDrawerOpen ? 'open' : ''}`}>
        <div className="backstage-drawer-header">
          <p className="backstage-drawer-title">Run of Show</p>
          <div className="backstage-bank-pill">Time Bank: +{formatDuration(timeBankSec)}</div>
        </div>

        <div className="backstage-drawer-list">
          {segments.map((segment, index) => {
            const isPast = index < currentSegmentIndex;
            const isCurrent = index === currentSegmentIndex;
            const isUpcoming = index > currentSegmentIndex;
            const scheduledStartMs = scheduleAnchorMs + (scheduleOffsetsSec[index] ?? 0) * 1000;
            const projectedStartMs = projectedScheduleMs[index] ?? scheduledStartMs;

            return (
              <article
                key={segment.id}
                className={`backstage-drawer-row${isCurrent ? ' current' : ''}${
                  isPast ? ' past' : ''
                }`}
              >
                <div className="backstage-drawer-row-top">
                  <span>{index + 1}.</span>
                  <span>{segment.title || 'Untitled Segment'}</span>
                </div>
                <div className="backstage-drawer-row-bottom">
                  <span>{formatClockTimestamp(scheduledStartMs, true)}</span>
                  <span>{formatDuration(segment.durationSec)}</span>
                  {isUpcoming ? (
                    <span>→ {formatClockTimestamp(projectedStartMs, true)}</span>
                  ) : isPast ? (
                    <span>Completed</span>
                  ) : (
                    <span>Now</span>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="backstage-drawer-footer">
          <button type="button" className="backstage-back-to-setup" onClick={backToSetup}>
            Back to Setup
          </button>
        </div>
      </aside>

      <button
        type="button"
        className="backstage-timing-handle"
        onClick={toggleTimingDrawer}
        aria-label={timingDrawerOpen ? 'Hide timing check' : 'Show timing check'}
      >
        {timingDrawerOpen ? '▶' : '◀'}
      </button>

      <aside className={`backstage-timing-drawer ${timingDrawerOpen ? 'open' : ''}`}>
        <div className="backstage-timing-header">
          <p className="backstage-timing-title">Timing Check</p>
        </div>
        <div className="backstage-timing-body">
          <p className={`backstage-timing-main ${driftBadge.tone}`}>{driftBadge.text}</p>
        </div>
      </aside>

      <main className="backstage-stage">
        {!currentSegment ? (
          <section className="backstage-stage-card backstage-empty-presentation">
            <p>No active segment.</p>
            <button type="button" className="backstage-btn" onClick={backToSetup}>
              Back to Setup
            </button>
          </section>
        ) : (
          <section key={`${currentSegment.id}-${currentSegmentIndex}`} className="backstage-stage-card">
            <p className="backstage-segment-counter">
              Segment {currentSegmentIndex + 1} / {segments.length}
            </p>

            {currentSegment.type === 'pretape' ? (
              <div className="backstage-pretape-shell">
                <p className="backstage-pretape-kind">Pre-tape / Performance</p>
                <h1 className="backstage-pretape-title">{currentSegment.title || 'Untitled Segment'}</h1>
                <p className="backstage-pretape-elapsed">
                  Elapsed: {formatDuration(Math.floor(currentElapsedSec))}
                </p>
                <button type="button" className="backstage-complete-btn" onClick={goToNextSegment}>
                  {currentSegmentIndex === segments.length - 1 ? 'Finish Show' : 'Complete →'}
                </button>
              </div>
            ) : (
              <>
                <header className="backstage-live-header">
                  <span className="backstage-type-pill">
                    {currentSegment.type === 'intermission' ? 'INTERMISSION' : 'LIVE'}
                  </span>
                  {currentSegment.type === 'live' && (
                    <p className="backstage-presenter">
                      {currentSegment.presenter || 'Presenter TBD'}
                    </p>
                  )}
                  <h1 className="backstage-live-title">
                    {currentSegment.type === 'intermission'
                      ? 'INTERMISSION'
                      : currentSegment.title || 'Untitled Segment'}
                  </h1>
                </header>

                <div className="backstage-countdown-wrap">
                  <p
                    className={`backstage-countdown${
                      countdownState?.tone === 'bonus'
                        ? ' bonus'
                        : countdownState?.tone === 'over'
                        ? ' over'
                        : ''
                    }`}
                  >
                    {countdownState?.primary}
                  </p>
                  {countdownState && <p className="backstage-countdown-sub">{countdownState.secondary}</p>}
                </div>

                <div className="backstage-progress-shell">
                  <div className="backstage-progress-track">
                    <div className="backstage-progress-zone green" />
                    <div className="backstage-progress-zone yellow" />
                    <div className="backstage-progress-zone red" />
                    <div className="backstage-progress-fill" style={{ width: `${progressRatio * 100}%` }} />
                    <div className="backstage-progress-marker" style={{ left: `${progressRatio * 100}%` }} />
                  </div>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <nav className="backstage-control-bar" aria-label="Presentation controls">
        <button
          type="button"
          className="backstage-control-btn"
          onClick={goToPreviousSegment}
          disabled={currentSegmentIndex === 0}
        >
          ⏮ Previous
        </button>
        <button
          type="button"
          className="backstage-control-btn"
          onClick={togglePause}
          disabled={!currentSegment}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          type="button"
          className="backstage-control-btn primary"
          onClick={goToNextSegment}
          disabled={!currentSegment}
        >
          {currentSegmentIndex === segments.length - 1 ? 'Finish' : '⏭ Next'}
        </button>
      </nav>
    </div>
  );
};

export default BackstageTimer;
