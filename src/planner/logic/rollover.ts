import type { Award, Invitation, Piece, Season, Segment, WithId } from '../types';
import type { Fields } from './importers';
import { stripUndefined } from './records';
import { defaultSeason } from './season';
import { defaultSteps } from './steps';

/*
 * Pure planner for "Start {year} from {previous}". It decides what the new
 * season gets; the writer turns each `sourceId` into a deterministic doc id
 * (see `rolloverDocId`) so running it twice changes nothing.
 */

export interface RolloverSource {
  /** The previous season (fields only, id not needed). */
  season: Season;
  segments: WithId<Segment>[];
  awards: WithId<Award>[];
  /** Invitation ids are person ids. */
  invitations: WithId<Invitation>[];
}

export interface RolloverPlan {
  season: Fields<Season>;
  awards: { sourceId: string; award: Fields<Award> }[];
  segments: { sourceId: string; segment: Fields<Segment> }[];
  invitations: { personId: string; invitation: Fields<Invitation> }[];
  pieces: { sourceId: string; piece: Fields<Piece> }[];
}

/** Deterministic doc id for a record created from a previous season's record. */
export function rolloverDocId(kind: 'award' | 'segment' | 'piece', sourceId: string): string {
  return `${kind}-from-${sourceId}`;
}

/** 360 → '6', 390 → '6.5' (minutes, one decimal, no trailing .0). */
function minutesLabel(sec: number): string {
  return String(Math.round((sec / 60) * 10) / 10);
}

export function planRollover(source: RolloverSource, year: number): RolloverPlan {
  const { season: prev } = source;

  const season: Fields<Season> = {
    ...defaultSeason(year),
    showStartTime: prev.showStartTime,
    runtimeCapSec: prev.runtimeCapSec,
    bufferTargetSec: prev.bufferTargetSec,
    archived: false,
  };

  const awards = source.awards
    .filter((a) => a.returning)
    .map((a) => ({
      sourceId: a.id,
      award: stripUndefined({
        order: a.order,
        name: a.name,
        recognizes: a.recognizes,
        stage: 'idea' as const,
        returning: true,
        contenders: [],
        notes: a.notes,
      }),
    }));

  const segments = source.segments
    .filter((s) => s.ownerPersonIds.length === 0)
    .map((s) => ({
      sourceId: s.id,
      segment: stripUndefined({
        order: s.order,
        title: s.title,
        type: s.type,
        playbackSource: s.playbackSource,
        plannedSec: s.plannedSec,
        ownerPersonIds: [],
        presenterLabel: s.presenterLabel,
        notes: s.notes,
        hardTime: s.hardTime,
      }),
    }));

  const invitations = source.invitations
    .filter((inv) => inv.status === 'confirmed')
    .map((inv) => ({
      personId: inv.id,
      invitation: {
        status: 'invite?' as const,
        plusOnes: inv.plusOnes,
        brunch: false,
        rsvpIds: [],
      },
    }));

  const pieces = source.segments
    .filter((s) => s.ownerPersonIds.length > 0)
    .map((s) => ({
      sourceId: s.id,
      piece: {
        title: s.title,
        kind: 'contributor-deck' as const,
        ownerPersonIds: [...s.ownerPersonIds],
        order: s.order,
        steps: defaultSteps('contributor-deck'),
        estSec: s.plannedSec,
        links: [],
        notes: `Ask again? (${prev.year} slot: ${minutesLabel(s.plannedSec)} min)`,
      },
    }));

  return { season, awards, segments, invitations, pieces };
}
