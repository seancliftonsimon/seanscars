import { describe, expect, it } from "vitest";
import type { PieceKind } from "../types";
import type { PieceStep } from "../types";
import {
  DEFAULT_STEP_LABELS,
  cycleStatus,
  cycleStep,
  defaultSteps,
  deliveryStep,
  isComplete,
  nextStep,
  progress,
  revisionReceived,
  stepKey,
} from "./steps";

describe("stepKey", () => {
  it("makes kebab-case keys", () => {
    expect(stepKey("Nominees set")).toBe("nominees-set");
    expect(stepKey("Export at −3 dBFS and test loud")).toBe(
      "export-at-3-dbfs-and-test-loud",
    );
    expect(stepKey("Checked (arrow-key playback, audio levels)")).toBe(
      "checked-arrow-key-playback-audio-levels",
    );
  });
});

describe("defaultSteps", () => {
  it("defaults to todo", () => {
    expect(defaultSteps("slides-bit")).toEqual([
      { key: "draft", label: "Draft", status: "todo" },
      { key: "final", label: "Final", status: "todo" },
      { key: "in-master-deck", label: "In master deck", status: "todo" },
    ]);
  });

  it("applies the requested status", () => {
    expect(
      defaultSteps("other", "done").every((s) => s.status === "done"),
    ).toBe(true);
  });

  it("has unique keys per kind and the expected counts", () => {
    const counts: Record<PieceKind, number> = {
      "award-video": 7,
      song: 7,
      "slides-bit": 3,
      "contributor-deck": 5,
      other: 2,
    };
    for (const kind of Object.keys(DEFAULT_STEP_LABELS) as PieceKind[]) {
      const steps = defaultSteps(kind);
      expect(steps).toHaveLength(counts[kind]);
      expect(new Set(steps.map((s) => s.key)).size).toBe(steps.length);
    }
  });
});

const mk = (...statuses: PieceStep["status"][]): PieceStep[] =>
  statuses.map((status, i) => ({ key: `s${i}`, label: `Step ${i}`, status }));

describe("progress / nextStep / isComplete", () => {
  it("counts done steps and finds the next one", () => {
    const piece = { steps: mk("done", "doing", "todo") };
    expect(progress(piece)).toEqual({ done: 1, total: 3 });
    expect(nextStep(piece)?.key).toBe("s1");
    expect(isComplete(piece)).toBe(false);
  });

  it("handles complete and empty pieces", () => {
    expect(nextStep({ steps: mk("done", "done") })).toBeNull();
    expect(isComplete({ steps: mk("done", "done") })).toBe(true);
    expect(isComplete({ steps: [] })).toBe(true);
    expect(nextStep({ steps: [] })).toBeNull();
    expect(progress({ steps: [] })).toEqual({ done: 0, total: 0 });
  });
});

describe("cycleStatus / cycleStep", () => {
  it("cycles todo → doing → done → todo", () => {
    expect(cycleStatus("todo")).toBe("doing");
    expect(cycleStatus("doing")).toBe("done");
    expect(cycleStatus("done")).toBe("todo");
  });

  it("cycles only the indexed step without mutating", () => {
    const steps = mk("todo", "done");
    const out = cycleStep(steps, 1);
    expect(out.map((s) => s.status)).toEqual(["todo", "todo"]);
    expect(steps[1].status).toBe("done");
  });
});

describe("revisionReceived", () => {
  it("resets checked and master-deck steps and appends a dated note", () => {
    const steps = defaultSteps("contributor-deck", "done");
    const out = revisionReceived({ steps, notes: "first note" }, "2026-10-01");
    const byKey = Object.fromEntries(out.steps.map((s) => [s.key, s.status]));
    expect(byKey["submitted"]).toBe("done");
    expect(byKey["in-master-deck"]).toBe("todo");
    expect(byKey["checked-arrow-key-playback-audio-levels"]).toBe("todo");
    expect(out.notes).toBe("first note\n2026-10-01: revision received");
  });

  it("starts notes fresh when there are none", () => {
    expect(revisionReceived({ steps: [] }, "2026-10-01").notes).toBe(
      "2026-10-01: revision received",
    );
  });
});

describe("deliveryStep", () => {
  it("prefers submitted, else the last step, else null", () => {
    expect(deliveryStep({ steps: defaultSteps("contributor-deck") })?.key).toBe(
      "submitted",
    );
    expect(deliveryStep({ steps: defaultSteps("slides-bit") })?.key).toBe(
      "in-master-deck",
    );
    expect(deliveryStep({ steps: [] })).toBeNull();
  });
});
