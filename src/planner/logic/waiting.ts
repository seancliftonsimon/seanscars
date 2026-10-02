import type {
  Award,
  ChecklistItem,
  Piece,
  Question,
  Venue,
  WaitingOn,
  WaitingOnKind,
  WithId,
} from "../types";
import { deliveryStep, isComplete, nextStep } from "./steps";

export interface WaitingData {
  awards: WithId<Award>[];
  pieces: WithId<Piece>[];
  venues: WithId<Venue>[];
  questions: WithId<Question>[];
  checklist?: WithId<ChecklistItem>[];
}

export interface WaitReason {
  kind: WaitingOnKind;
  id: string;
  label: string;
  derived: boolean;
}

/** A wait on something that no longer exists is resolved (nothing to wait for). */
export function isResolved(w: WaitingOn, data: WaitingData): boolean {
  switch (w.kind) {
    case "award": {
      const award = data.awards.find((a) => a.id === w.id);
      return !award || Boolean(award.winnerContenderId);
    }
    case "piece": {
      const piece = data.pieces.find((p) => p.id === w.id);
      if (!piece) return true;
      return deliveryStep(piece)?.status === "done";
    }
    case "venue":
      return data.venues.some((v) => v.status === "booked");
    case "question": {
      const q = data.questions.find((x) => x.id === w.id);
      return !q || q.status === "decided";
    }
  }
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Human label for the target; the UI shows "waiting on {label}". */
export function waitingLabel(w: WaitingOn, data: WaitingData): string {
  switch (w.kind) {
    case "award": {
      const award = data.awards.find((a) => a.id === w.id);
      return award ? `${award.name} winner` : "a deleted item";
    }
    case "piece": {
      const piece = data.pieces.find((p) => p.id === w.id);
      return piece ? piece.title : "a deleted item";
    }
    case "venue":
      return "a booked venue";
    case "question": {
      const q = data.questions.find((x) => x.id === w.id);
      return q ? truncate(q.question, 60) : "a deleted item";
    }
  }
}

/** Why a piece is stuck, or null. Derived award waits come before manual ones. */
export function derivedWaiting(
  piece: WithId<Piece>,
  data: WaitingData,
): WaitReason | null {
  if (isComplete(piece)) return null;

  if (piece.kind === "award-video" && piece.awardId) {
    const award = data.awards.find((a) => a.id === piece.awardId);
    const winnerIndex = piece.steps.findIndex(
      (s) => s.key === "winner-decided",
    );
    const next = nextStep(piece);
    if (award && !award.winnerContenderId && winnerIndex >= 0 && next) {
      if (piece.steps.indexOf(next) >= winnerIndex) {
        const target: WaitingOn = { kind: "award", id: award.id };
        return { ...target, label: waitingLabel(target, data), derived: true };
      }
    }
  }

  const manual = piece.waitingOn;
  if (manual && !isResolved(manual, data)) {
    return { ...manual, label: waitingLabel(manual, data), derived: false };
  }
  return null;
}

function matches(target: WaitingOn, kind: WaitingOnKind, id: string): boolean {
  return kind === target.kind && (kind === "venue" || id === target.id);
}

/** Pieces (derived waits included) and open checklist items (manual waits) blocked on `target`. */
export function blockedCount(target: WaitingOn, data: WaitingData): number {
  let count = 0;
  for (const piece of data.pieces) {
    const reason = derivedWaiting(piece, data);
    if (reason && matches(target, reason.kind, reason.id)) count += 1;
  }
  for (const item of data.checklist ?? []) {
    if (item.done || !item.waitingOn) continue;
    if (isResolved(item.waitingOn, data)) continue;
    if (matches(target, item.waitingOn.kind, item.waitingOn.id)) count += 1;
  }
  return count;
}

/** Where a "waiting on" reason lives, so the blocker is one click away. */
export function waitHref(w: Pick<WaitReason, 'kind' | 'id'>): string {
  switch (w.kind) {
    case 'award':
      return `/plan/make?view=awards&award=${w.id}`;
    case 'piece':
      return `/plan/make?piece=${w.id}`;
    case 'question':
      return `/plan/prep?question=${w.id}`;
    case 'venue':
      return '/plan/prep?view=venues';
  }
}
