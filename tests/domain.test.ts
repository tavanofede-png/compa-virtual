import { describe, it, expect } from "vitest";
import {
  demoSnapshot,
  generatePlan,
  availableMinutes,
  transition,
  penalty,
  publicSnapshot,
  ageAt,
  methods,
  type Snapshot,
} from "../packages/domain/src/index";
const now = "2026-09-07T12:00:00Z";
function fixture(): Snapshot {
  const s = demoSnapshot();
  s.items.forEach((x) => (x.due_date = "2026-09-12"));
  return s;
}
describe("planner constraints", () => {
  it("is reproducible, preserves input, creates no overlap and leaves five-minute breaks", () => {
    const s = fixture(),
      input = {
        profile: s.profile!,
        items: s.items,
        blocks: s.blocks,
        sessions: [],
        now,
      },
      before = JSON.stringify(input);
    const a = generatePlan(input),
      b = generatePlan(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(before);
    for (const day of new Set(a.slots.map((x) => x.date))) {
      const slots = a.slots.filter((x) => x.date === day);
      expect(
        slots.reduce((n, x) => n + x.duration_minutes, 0),
      ).toBeLessThanOrEqual(90);
      slots.forEach((slot, i) => {
        expect(
          availableMinutes(day, s.profile!, s.blocks)
            .slice(slot.start_minute, slot.start_minute + slot.duration_minutes)
            .every(Boolean),
        ).toBe(true);
        if (i)
          expect(slot.start_minute).toBeGreaterThanOrEqual(
            slots[i - 1].start_minute + slots[i - 1].duration_minutes + 5,
          );
      });
    }
  });
  it("keeps date-only exams off exam day and reports overload", () => {
    const s = fixture();
    s.items = s.items.filter((x) => x.kind === "EXAM");
    s.items[0].due_date = "2026-09-08";
    s.items[0].effort_minutes = 1200;
    const p = generatePlan({
      profile: s.profile!,
      items: s.items,
      blocks: s.blocks,
      sessions: [],
      now,
    });
    expect(p.slots.every((x) => x.date < "2026-09-08")).toBe(true);
    expect(p.unscheduled[0].minutes).toBeGreaterThan(1000);
  });
  it("does not invent availability and respects sleep across midnight", () => {
    const s = fixture();
    expect(
      generatePlan({
        profile: s.profile!,
        items: s.items,
        blocks: [],
        sessions: [],
        now,
      }).slots,
    ).toHaveLength(0);
    const free = availableMinutes("2026-09-07", s.profile!, [
      {
        id: "a",
        label: "Todo",
        day_of_week: 1,
        start_minute: 0,
        end_minute: 1440,
        kind: "AVAILABLE",
      },
    ]);
    expect(free[0]).toBe(false);
    expect(free[420]).toBe(true);
    expect(free[1380]).toBe(false);
  });
  it("uses actual local date at a UTC day boundary", () => {
    expect(ageAt("2008-09-07", "2026-09-06")).toBe(17);
    expect(ageAt("2008-09-07", "2026-09-07")).toBe(18);
  });
});
describe("academic transitions", () => {
  it("rewards completing a task only once and rejects unowned subjects", () => {
    const s = fixture(),
      done = transition(
        s,
        { type: "item.complete", payload: { id: s.items[0].id } },
        now,
      );
    expect(done.coins).toBe(s.coins + 5);
    expect(
      transition(
        done,
        { type: "item.complete", payload: { id: s.items[0].id } },
        now,
      ).coins,
    ).toBe(done.coins);
    expect(() =>
      transition(
        s,
        {
          type: "item.save",
          payload: {
            ...s.items[0],
            subject_id: "00000000-0000-4000-8000-000000000098",
          },
        },
        now,
      ),
    ).toThrow("materia");
  });
  it("requires accepted plans; rewards a session only once", () => {
    let s = fixture();
    s = transition(s, { type: "plan.propose", payload: {} }, now);
    const plan = s.plans[0],
      slot = plan.slots[0];
    expect(() =>
      transition(
        s,
        {
          type: "session.complete",
          payload: {
            slot_id: slot.id,
            reflection: "Pude comprobar el resultado.",
          },
        },
        now,
      ),
    ).toThrow("Aceptá");
    s = transition(
      s,
      { type: "plan.accept", payload: { id: plan.id, version: plan.version } },
      now,
    );
    const before = s.coins;
    s = transition(
      s,
      {
        type: "session.complete",
        payload: {
          slot_id: slot.id,
          reflection: "Pude comprobar el resultado.",
        },
      },
      now,
    );
    expect(s.coins).toBe(before + 10);
    expect(
      transition(
        s,
        {
          type: "session.complete",
          payload: { slot_id: slot.id, reflection: "Reintento." },
        },
        now,
      ).coins,
    ).toBe(s.coins);
  });
  it("retains completed history when proposing and accepting changes", () => {
    let s = fixture();
    s = transition(s, { type: "plan.propose", payload: {} }, now);
    s = transition(
      s,
      { type: "plan.accept", payload: { id: s.plans[0].id, version: 1 } },
      now,
    );
    s = transition(
      s,
      {
        type: "session.complete",
        payload: {
          slot_id: s.plans[0].slots[0].id,
          reflection: "Ahora puedo explicarlo.",
        },
      },
      now,
    );
    const completed = structuredClone(s.sessions);
    s = transition(s, { type: "plan.propose", payload: {} }, now);
    expect(s.sessions).toEqual(completed);
    expect(s.plans.some((x) => x.status === "ACCEPTED")).toBe(true);
  });
  it("limits penalties to acknowledged misses, 15 per seven days, and available balance", () => {
    expect(penalty(100, 0, false, false)).toBe(0);
    expect(penalty(100, 0, true, true)).toBe(0);
    expect(penalty(3, 0, true, false)).toBe(3);
    expect(penalty(100, 13, true, false)).toBe(2);
    expect(penalty(100, 15, true, false)).toBe(0);
    const s = fixture();
    const next = transition(
      s,
      {
        type: "checkin.save",
        payload: { learned: "", news: "", outcome: "PENDING" },
      },
      now,
    );
    expect(next.coins).toBe(s.coins);
  });
  it("does not reveal answer keys before an attempt and only grants one correction bonus", () => {
    let s = fixture();
    expect(publicSnapshot(s).quizzes[0].questions[0].answer).toBeUndefined();
    const initial = s.coins;
    s = transition(
      s,
      {
        type: "quiz.submit",
        payload: { id: "demo-quiz", answers: { "demo-q1": "2" } },
      },
      now,
    );
    expect(s.coins).toBe(initial + 10);
    s = transition(
      s,
      {
        type: "quiz.submit",
        payload: { id: "demo-quiz", answers: { "demo-q1": "3" } },
      },
      now,
    );
    expect(s.coins).toBe(initial + 15);
    s = transition(
      s,
      {
        type: "quiz.submit",
        payload: { id: "demo-quiz", answers: { "demo-q1": "3" } },
      },
      now,
    );
    expect(s.coins).toBe(initial + 15);
  });
  it("validates purchases without removing owned objects after spending", () => {
    let s = fixture();
    s = transition(s, { type: "inventory.buy", payload: { id: "scarf" } }, now);
    expect(s.coins).toBe(0);
    expect(s.inventory).toContain("scarf");
    expect(
      transition(s, { type: "inventory.buy", payload: { id: "scarf" } }, now)
        .coins,
    ).toBe(0);
    expect(() =>
      transition(s, { type: "inventory.buy", payload: { id: "globe" } }, now),
    ).toThrow("monedas");
  });
  it("ships all 17 required methods with differentiated evidence", () => {
    expect(methods).toHaveLength(17);
    expect(new Set(methods.map((x) => x.id)).size).toBe(17);
    expect(methods.find((x) => x.id === "sq3r")?.evidence).toBe("MIXTA");
  });
  it("allows a correction bonus after several unsuccessful attempts", () => {
    let s = fixture();
    const coins = s.coins;
    for (const answer of ["2", "2", "3", "3"])
      s = transition(
        s,
        {
          type: "quiz.submit",
          payload: { id: "demo-quiz", answers: { "demo-q1": answer } },
        },
        now,
      );
    expect(s.coins).toBe(coins + 15);
  });
  it("spaces flashcards after an attempt without advancing twice on a retry", () => {
    let s = fixture();
    s.quizzes[0].kind = "FLASHCARDS";
    const rate = {
      type: "flashcard.rate",
      payload: {
        quiz_id: "demo-quiz",
        question_id: "demo-q1",
        remembered: true,
      },
    };
    expect(() => transition(s, rate, now)).toThrow("Intentá");
    s = transition(
      s,
      {
        type: "quiz.submit",
        payload: { id: "demo-quiz", answers: { "demo-q1": "3" } },
      },
      now,
    );
    s = transition(s, rate, now);
    expect(s.flashcard_reviews?.[0].due_date).toBe("2026-09-09");
    expect(transition(s, rate, now).flashcard_reviews).toEqual(
      s.flashcard_reviews,
    );
  });
});
