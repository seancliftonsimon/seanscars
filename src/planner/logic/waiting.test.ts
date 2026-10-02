import { describe, expect, it } from "vitest";
import type {
  Award,
  ChecklistItem,
  Piece,
  Question,
  Venue,
  WithId,
} from "../types";
import { defaultSteps, nextStep } from "./steps";
import {
  blockedCount,
  derivedWaiting,
  isResolved,
  waitingLabel,
  type WaitingData,
} from "./waiting";

const award = (over: Partial<WithId<Award>> = {}): WithId<Award> => ({
  id: "a1",
  order: 1000,
  name: "Best Llama",
  stage: "nominees",
  returning: false,
  contenders: [{ id: "c1", label: "Llama One", nominee: true }],
  ...over,
});

const piece = (over: Partial<WithId<Piece>> = {}): WithId<Piece> => ({
  id: "p1",
  title: "Llama video",
  kind: "award-video",
  ownerPersonIds: [],
  order: 1000,
  steps: defaultSteps("award-video"),
  links: [],
  ...over,
});

const venue = (over: Partial<WithId<Venue>> = {}): WithId<Venue> => ({
  id: "v1",
  name: "Hall",
  status: "inquired",
  links: [],
  ...over,
});

const question = (over: Partial<WithId<Question>> = {}): WithId<Question> => ({
  id: "q1",
  question: "Serve snacks?",
  status: "open",
  ...over,
});

const item = (
  over: Partial<WithId<ChecklistItem>> = {},
): WithId<ChecklistItem> => ({
  id: "k1",
  text: "Print signs",
  done: false,
  order: 1000,
  ...over,
});

const data = (over: Partial<WaitingData> = {}): WaitingData => ({
  awards: [],
  pieces: [],
  venues: [],
  questions: [],
  ...over,
});

const twoDone = () =>
  defaultSteps("award-video").map((s, i) => ({
    ...s,
    status: i < 2 ? ("done" as const) : ("todo" as const),
  }));

describe("award-video derived wait", () => {
  it("waits on the award winner, then clears once decided", () => {
    const p = piece({ awardId: "a1", steps: twoDone() });
    const waiting = derivedWaiting(p, data({ awards: [award()], pieces: [p] }));
    expect(waiting).toEqual({
      kind: "award",
      id: "a1",
      label: "Best Llama winner",
      derived: true,
    });

    const decided = data({
      awards: [award({ winnerContenderId: "c1" })],
      pieces: [p],
    });
    expect(derivedWaiting(p, decided)).toBeNull();
    expect(nextStep(p)?.label).toBe("Winner decided");
  });

  it("does not wait while earlier steps are still open", () => {
    const p = piece({ awardId: "a1" });
    expect(derivedWaiting(p, data({ awards: [award()] }))).toBeNull();
  });

  it("has no derived wait without a winner-decided step", () => {
    const p = piece({
      awardId: "a1",
      steps: [{ key: "edit", label: "Edit", status: "todo" }],
    });
    expect(derivedWaiting(p, data({ awards: [award()] }))).toBeNull();
  });

  it("never waits when complete", () => {
    const p = piece({
      awardId: "a1",
      steps: defaultSteps("award-video", "done"),
      waitingOn: { kind: "question", id: "q1" },
    });
    expect(
      derivedWaiting(p, data({ awards: [award()], questions: [question()] })),
    ).toBeNull();
  });
});

describe("manual waits resolve", () => {
  it("award", () => {
    const w = { kind: "award" as const, id: "a1" };
    expect(isResolved(w, data({ awards: [award()] }))).toBe(false);
    expect(
      isResolved(w, data({ awards: [award({ winnerContenderId: "c1" })] })),
    ).toBe(true);
  });

  it("piece via its delivery step", () => {
    const w = { kind: "piece" as const, id: "d1" };
    const deck = (status: "todo" | "done") =>
      piece({
        id: "d1",
        kind: "contributor-deck",
        steps: defaultSteps("contributor-deck").map((s) =>
          s.key === "submitted" ? { ...s, status } : s,
        ),
      });
    expect(isResolved(w, data({ pieces: [deck("todo")] }))).toBe(false);
    expect(isResolved(w, data({ pieces: [deck("done")] }))).toBe(true);
  });

  it("venue, ignoring the id", () => {
    const w = { kind: "venue" as const, id: "anything" };
    expect(isResolved(w, data({ venues: [venue()] }))).toBe(false);
    expect(
      isResolved(
        w,
        data({ venues: [venue(), venue({ id: "v2", status: "booked" })] }),
      ),
    ).toBe(true);
  });

  it("question", () => {
    const w = { kind: "question" as const, id: "q1" };
    expect(isResolved(w, data({ questions: [question()] }))).toBe(false);
    expect(
      isResolved(w, data({ questions: [question({ status: "decided" })] })),
    ).toBe(true);
  });

  it("a deleted target is resolved and labelled as such", () => {
    const w = { kind: "question" as const, id: "gone" };
    expect(isResolved(w, data())).toBe(true);
    expect(waitingLabel(w, data())).toBe("a deleted item");
  });
});

describe("labels and manual piece waits", () => {
  it("labels each kind and truncates questions", () => {
    const long = "x".repeat(70);
    const d = data({
      awards: [award()],
      pieces: [piece()],
      questions: [question({ id: "q2", question: long })],
    });
    expect(waitingLabel({ kind: "award", id: "a1" }, d)).toBe(
      "Best Llama winner",
    );
    expect(waitingLabel({ kind: "piece", id: "p1" }, d)).toBe("Llama video");
    expect(waitingLabel({ kind: "venue", id: "x" }, d)).toBe("a booked venue");
    expect(waitingLabel({ kind: "question", id: "q2" }, d)).toBe(
      `${"x".repeat(60)}…`,
    );
  });

  it("reports an unresolved manual wait as not derived", () => {
    const p = piece({
      kind: "other",
      steps: defaultSteps("other"),
      waitingOn: { kind: "question", id: "q1" },
    });
    const d = data({ questions: [question()] });
    expect(derivedWaiting(p, d)).toEqual({
      kind: "question",
      id: "q1",
      label: "Serve snacks?",
      derived: false,
    });
    expect(
      derivedWaiting(p, data({ questions: [question({ status: "decided" })] })),
    ).toBeNull();
  });
});

describe("blockedCount", () => {
  it("counts derived piece waits and open checklist items", () => {
    const p1 = piece({ awardId: "a1", steps: twoDone() });
    const p2 = piece({ id: "p2", awardId: "a1", steps: twoDone() });
    const other = piece({
      id: "p3",
      kind: "other",
      steps: defaultSteps("other"),
    });
    const d = data({
      awards: [award()],
      pieces: [p1, p2, other],
      checklist: [
        item({ waitingOn: { kind: "award", id: "a1" } }),
        item({ id: "k2", done: true, waitingOn: { kind: "award", id: "a1" } }),
        item({ id: "k3", waitingOn: { kind: "award", id: "a2" } }),
      ],
    });
    expect(blockedCount({ kind: "award", id: "a1" }, d)).toBe(3);
    expect(
      blockedCount(
        { kind: "award", id: "a1" },
        { ...d, awards: [award({ winnerContenderId: "c1" })] },
      ),
    ).toBe(0);
  });

  it("matches any venue id and ignores resolved waits", () => {
    const p = piece({
      kind: "other",
      steps: defaultSteps("other"),
      waitingOn: { kind: "venue", id: "v9" },
    });
    const checklist = [item({ waitingOn: { kind: "venue", id: "v1" } })];
    const d = data({ pieces: [p], venues: [venue()], checklist });
    expect(blockedCount({ kind: "venue", id: "v1" }, d)).toBe(2);
    expect(
      blockedCount(
        { kind: "venue", id: "v1" },
        { ...d, venues: [venue({ status: "booked" })] },
      ),
    ).toBe(0);
  });

  it("counts nothing for a deleted target", () => {
    const p = piece({
      kind: "other",
      steps: defaultSteps("other"),
      waitingOn: { kind: "question", id: "gone" },
    });
    expect(
      blockedCount({ kind: "question", id: "gone" }, data({ pieces: [p] })),
    ).toBe(0);
  });
});

describe('waitHref', () => {
  it('links to the blocker', async () => {
    const { waitHref } = await import('./waiting');
    expect(waitHref({ kind: 'award', id: 'a' })).toBe('/plan/make?view=awards&award=a');
    expect(waitHref({ kind: 'question', id: 'q' })).toBe('/plan/prep?question=q');
    expect(waitHref({ kind: 'venue', id: 'any' })).toBe('/plan/prep?view=venues');
  });
});
