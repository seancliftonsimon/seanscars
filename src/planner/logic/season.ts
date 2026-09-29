import type { Season } from '../types';

/*
 * Pure season helpers: defaults, unit conversion, validation and choosing
 * which season the planner opens on.
 */

export const DEFAULT_SHOW_START = '19:00';
export const DEFAULT_RUNTIME_CAP_SEC = 180 * 60;
export const DEFAULT_BUFFER_TARGET_SEC = 10 * 60;

/** Matches the timer docs the security rules let the planner publish to. */
export const TIMER_DOC_ID_PATTERN = /^seanscars-20[0-9]{2}-rundown(-test)?$/;

const HHMM = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

export function isHHMM(value: string): boolean {
  return HHMM.test(value);
}

export function isIsoDate(value: string): boolean {
  return YMD.test(value);
}

export function isValidSeasonYear(year: number): boolean {
  return Number.isInteger(year) && year >= 2000 && year <= 2099;
}

export function timerDocIdFor(year: number): string {
  return `seanscars-${year}-rundown`;
}

export function isPublishableTimerDocId(id: string): boolean {
  return TIMER_DOC_ID_PATTERN.test(id);
}

/** Seconds → whole-ish minutes for display (rounded to 0.1). */
export function secToMinutes(sec: number): number {
  return Math.round((sec / 60) * 10) / 10;
}

/** Minutes → whole seconds for storage. */
export function minutesToSec(minutes: number): number {
  return Math.round(minutes * 60);
}

/** Fields of a brand-new season with the planner defaults. */
export function defaultSeason(year: number): Omit<Season, 'createdAt' | 'updatedAt' | 'updatedBy'> {
  return {
    year,
    name: `${year} Award Sharemony`,
    showStartTime: DEFAULT_SHOW_START,
    runtimeCapSec: DEFAULT_RUNTIME_CAP_SEC,
    bufferTargetSec: DEFAULT_BUFFER_TARGET_SEC,
    timerDocId: timerDocIdFor(year),
    archived: false,
  };
}

/** Suggested year for the next season to create. */
export function suggestNextYear(seasons: ReadonlyArray<{ year: number }>, now = new Date()): number {
  if (seasons.length === 0) return now.getFullYear() + 1;
  return Math.max(...seasons.map((s) => s.year)) + 1;
}

/**
 * Which season to open: the remembered one if it still exists, otherwise
 * the latest non-archived season, otherwise the latest season, otherwise null.
 */
export function pickSeasonId(
  seasons: ReadonlyArray<{ id: string; year: number; archived?: boolean }>,
  rememberedId: string | null,
): string | null {
  if (rememberedId && seasons.some((s) => s.id === rememberedId)) return rememberedId;
  const byYearDesc = [...seasons].sort((a, b) => b.year - a.year);
  const active = byYearDesc.find((s) => !s.archived);
  return (active ?? byYearDesc[0])?.id ?? null;
}

/** Editable form of a season (times as text, cap and buffer in minutes). */
export interface SeasonDraft {
  name: string;
  showDate: string;
  doorsTime: string;
  showStartTime: string;
  runtimeCapMin: string;
  bufferTargetMin: string;
  capacity: string;
  timerDocId: string;
  masterDeckUrl: string;
  driveFolderUrl: string;
  theme: string;
  archived: boolean;
}

export function seasonToDraft(season: Season): SeasonDraft {
  return {
    name: season.name ?? '',
    showDate: season.showDate ?? '',
    doorsTime: season.doorsTime ?? '',
    showStartTime: season.showStartTime ?? DEFAULT_SHOW_START,
    runtimeCapMin: String(secToMinutes(season.runtimeCapSec ?? DEFAULT_RUNTIME_CAP_SEC)),
    bufferTargetMin: String(secToMinutes(season.bufferTargetSec ?? DEFAULT_BUFFER_TARGET_SEC)),
    capacity: season.capacity === undefined ? '' : String(season.capacity),
    timerDocId: season.timerDocId ?? timerDocIdFor(season.year),
    masterDeckUrl: season.masterDeckUrl ?? '',
    driveFolderUrl: season.driveFolderUrl ?? '',
    theme: season.theme ?? '',
    archived: Boolean(season.archived),
  };
}

export type SeasonDraftErrors = Partial<Record<keyof SeasonDraft, string>>;

/** Patch written by the season settings form; `undefined` clears a field. */
export type SeasonPatch = Partial<Omit<Season, 'year' | 'createdAt' | 'updatedAt' | 'updatedBy'>>;

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : NaN;
}

/** Validates a draft and converts it to a Firestore patch. */
export function draftToPatch(
  draft: SeasonDraft,
): { ok: true; patch: SeasonPatch } | { ok: false; errors: SeasonDraftErrors } {
  const errors: SeasonDraftErrors = {};

  const name = draft.name.trim();
  if (!name) errors.name = 'Name is required.';

  const showDate = optionalText(draft.showDate);
  if (showDate && !isIsoDate(showDate)) errors.showDate = 'Use YYYY-MM-DD.';

  const doorsTime = optionalText(draft.doorsTime);
  if (doorsTime && !isHHMM(doorsTime)) errors.doorsTime = 'Use HH:MM (24-hour).';

  const showStartTime = draft.showStartTime.trim();
  if (!isHHMM(showStartTime)) errors.showStartTime = 'Use HH:MM (24-hour).';

  const cap = parseNumber(draft.runtimeCapMin);
  if (cap === null || Number.isNaN(cap) || cap <= 0) errors.runtimeCapMin = 'Enter minutes greater than 0.';

  const buffer = parseNumber(draft.bufferTargetMin);
  if (buffer === null || Number.isNaN(buffer) || buffer < 0) errors.bufferTargetMin = 'Enter 0 or more minutes.';

  const capacity = parseNumber(draft.capacity);
  if (capacity !== null && (Number.isNaN(capacity) || capacity < 0 || !Number.isInteger(capacity))) {
    errors.capacity = 'Enter a whole number.';
  }

  const timerDocId = draft.timerDocId.trim();
  if (!timerDocId) errors.timerDocId = 'Timer doc id is required.';

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    patch: {
      name,
      showDate,
      doorsTime,
      showStartTime,
      runtimeCapSec: minutesToSec(cap as number),
      bufferTargetSec: minutesToSec(buffer as number),
      capacity: capacity === null ? undefined : capacity,
      timerDocId,
      masterDeckUrl: optionalText(draft.masterDeckUrl),
      driveFolderUrl: optionalText(draft.driveFolderUrl),
      theme: optionalText(draft.theme),
      archived: draft.archived,
    },
  };
}
