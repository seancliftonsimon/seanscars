import type { Piece, PieceKind, PieceStep, StepStatus } from "../types";

/*
 * Default steps for each kind of piece. A piece's steps are copied from
 * here when it is created, then edited freely.
 */

export const DEFAULT_STEP_LABELS: Record<PieceKind, string[]> = {
  "award-video": [
    "Nominees set",
    "Images and clips gathered",
    "Winner decided",
    "Script and voice-over",
    "Edit",
    "Export at −3 dBFS and test loud",
    "In master deck",
  ],
  song: [
    "Song picked",
    "Lyrics",
    "Vocals recorded",
    "Mix",
    "Video or backing track",
    "Rehearsed",
    "In playlist",
  ],
  "slides-bit": ["Draft", "Final", "In master deck"],
  "contributor-deck": [
    "Asked",
    "Title and minutes confirmed",
    "Submitted",
    "Checked (arrow-key playback, audio levels)",
    "In master deck",
  ],
  other: ["To do", "Done"],
};

/** Stable kebab-case key for a step label, e.g. 'Nominees set' → 'nominees-set'. */
export function stepKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Fresh steps for a piece of `kind`, all at `status`. */
export function defaultSteps(
  kind: PieceKind,
  status: StepStatus = "todo",
): PieceStep[] {
  return DEFAULT_STEP_LABELS[kind].map((label) => ({
    key: stepKey(label),
    label,
    status,
  }));
}

export function progress(piece: Pick<Piece, "steps">): {
  done: number;
  total: number;
} {
  return {
    done: piece.steps.filter((s) => s.status === "done").length,
    total: piece.steps.length,
  };
}

/** First step that isn't done, or null when all are done (or there are none). */
export function nextStep(piece: Pick<Piece, "steps">): PieceStep | null {
  return piece.steps.find((s) => s.status !== "done") ?? null;
}

/** All steps done; a piece with zero steps is complete. */
export function isComplete(piece: Pick<Piece, "steps">): boolean {
  return piece.steps.every((s) => s.status === "done");
}

/** todo → doing → done → todo */
export function cycleStatus(status: StepStatus): StepStatus {
  if (status === "todo") return "doing";
  if (status === "doing") return "done";
  return "todo";
}

/** Steps with the step at `index` cycled. */
export function cycleStep(steps: PieceStep[], index: number): PieceStep[] {
  return steps.map((s, i) =>
    i === index ? { ...s, status: cycleStatus(s.status) } : s,
  );
}

/**
 * "Revision received" on a contributor deck: the checking and master-deck
 * steps go back to todo and a dated line is appended to the notes.
 */
export function revisionReceived(
  piece: Pick<Piece, "steps" | "notes">,
  todayIso: string,
): { steps: PieceStep[]; notes: string } {
  const steps = piece.steps.map((s) =>
    s.key.startsWith("checked") || s.key === "in-master-deck"
      ? { ...s, status: "todo" as const }
      : s,
  );
  const line = `${todayIso}: revision received`;
  return { steps, notes: piece.notes ? `${piece.notes}\n${line}` : line };
}

/** The step that marks a piece delivered: key 'submitted' if present, else the last step. */
export function deliveryStep(piece: Pick<Piece, "steps">): PieceStep | null {
  return (
    piece.steps.find((s) => s.key === "submitted") ??
    piece.steps[piece.steps.length - 1] ??
    null
  );
}
