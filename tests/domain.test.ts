import { describe, it, expect } from "vitest";
import {
  demoSnapshot,
  generatePlan,
  availableMinutes,
  transition,
  publicSnapshot,
  ageAt,
  methods,
  homeSummary,
  nextStudyAction,
  prepareFreeStudy,
  prepareDailyStudy,
  prepareConsentRecord,
  consentStatusFromRows,
  consentScopedSnapshot,
  CONSENT_POLICY_VERSION,
  roomIds,
  rooms,
  today,
  memoryOriginLabel,
  type Snapshot,
} from "../packages/domain/src/index";
const now = "2026-09-07T12:00:00Z";
function fixture(): Snapshot {
  const s = demoSnapshot();
  s.items.forEach((x) => (x.due_date = "2026-09-12"));
  return s;
}

describe("editable academic memory", () => {
  it("keeps provenance on edits and does not accept a forged source from a manual command", () => {
    const state = fixture();
    state.memories = [{ id: "existing", content: "Bloques de 25 minutos", category: "PREFERENCE",
      origin: "COMPANION", source_message_id: "original-request", created_at: now }];
    const updated = transition(state, { type: "memory.save", payload: { id: "existing",
      content: "Bloques de 20 minutos", category: "PREFERENCE", source_message_id: "foreign-request" } }, now);
    expect(updated.memories[0]).toMatchObject({ content: "Bloques de 20 minutos", source_message_id: "original-request",
      updated_by: "USER", updated_at: now });
    expect(memoryOriginLabel(updated.memories[0])).toContain("editado por vos");
    const added = transition(updated, { type: "memory.save", payload: { content: "Prefiero tarjetas",
      category: "PREFERENCE", origin: "COMPANION", source_message_id: "foreign-request" } }, now);
    expect(added.memories.at(-1)?.origin).toBe("MANUAL");
    expect(added.memories.at(-1)?.source_message_id).toBeUndefined();
    const deleted = transition(updated, { type: "memory.delete", payload: { id: "existing" } }, now);
    expect(deleted.memories).toHaveLength(0);
    expect(deleted.messages).toEqual(state.messages);
  });

  it("bounds new memory while allowing legacy collections to be edited and reduced", () => {
    const state = fixture();
    state.memories = Array.from({ length: 101 }, (_, index) => ({ id: `m-${index}`,
      content: `Recuerdo ${index}`, category: "TOPIC" as const }));
    expect(() => transition(state, { type: "memory.save", payload: { content: "Nuevo", category: "TOPIC" } }, now)).toThrow("100 recuerdos");
    const edited = transition(state, { type: "memory.save", payload: { id: "m-0", content: "Corregido", category: "TOPIC" } }, now);
    expect(edited.memories[0].content).toBe("Corregido");
    expect(edited.memories).toHaveLength(101);
    expect(memoryOriginLabel(edited.memories[0])).toContain("sin origen registrado");
    expect(transition(edited, { type: "memory.delete", payload: { id: "m-0" } }, now).memories).toHaveLength(100);
  });
});
describe("bedroom selection", () => {
  it("accepts and saves every room displayed in the catalog", () => {
    expect(roomIds).toHaveLength(12);
    expect(rooms.map((room) => room.id)).toEqual([...roomIds]);
    for (const room of rooms) {
      const initial = demoSnapshot();
      const updated = transition(
        initial,
        {
          type: "companion.save",
          payload: {
            ...initial.companion,
            room_style: room.id,
            room_theme: room.theme,
          },
        },
        now,
      );
      expect(updated.companion.room_style).toBe(room.id);
    }
  });
});
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
  it("starts free study without a task, restores a paused session, and keeps checkout optional", () => {
    const initial = fixture();
    initial.items = [];
    initial.plans = [];
    initial.subjects = [];
    const started = transition(
      initial,
      {
        type: "session.start",
        payload: {
          objective: "Repasar biología",
          planned_minutes: 20,
          method_id: "retrieval",
        },
      },
      now,
    );
    const id = started.activeSession!.id;
    expect(started.activeSession?.source).toBe("FREE");
    expect(() =>
      transition(
        started,
        { type: "session.start", payload: { objective: "Otra" } },
        now,
      ),
    ).toThrow("en curso");
    const paused = transition(
      started,
      { type: "session.pause", payload: { id } },
      "2026-09-07T12:03:00Z",
    );
    expect(paused.activeSession?.elapsed_seconds).toBe(180);
    const resumed = transition(
      paused,
      { type: "session.resume", payload: { id } },
      "2026-09-07T12:20:00Z",
    );
    const done = transition(
      resumed,
      { type: "session.finish", payload: { id } },
      "2026-09-07T12:22:00Z",
    );
    expect(done.activeSession).toBeNull();
    expect(done.sessions[0]).toMatchObject({
      id,
      source: "FREE",
      objective: "Repasar biología",
      actual_seconds: 300,
      duration_minutes: 5,
      reflection: "",
    });
    expect(done.coins).toBe(initial.coins + 10);
    expect(
      transition(
        done,
        { type: "session.finish", payload: { id } },
        "2026-09-07T12:22:00Z",
      ).coins,
    ).toBe(done.coins);
  });
  it("requires an explicit handoff before a second device can control a session", () => {
    const first = "11111111-1111-4111-8111-111111111111";
    const second = "22222222-2222-4222-8222-222222222222";
    const initial = fixture();
    const started = transition(
      initial,
      { type: "session.start", payload: { objective: "Repasar", device_id: first } },
      "2026-09-07T12:00:00Z",
    );
    const id = started.activeSession!.id;
    expect(started.activeSession?.controller_device_id).toBe(first);
    expect(() => transition(
      started,
      { type: "session.pause", payload: { id, device_id: second } },
      "2026-09-07T12:03:00Z",
    )).toThrow("Tomá el control");
    const handedOff = transition(
      started,
      { type: "session.takeControl", payload: { id, device_id: second } },
      "2026-09-07T12:06:00Z",
    );
    expect(handedOff.activeSession).toMatchObject({
      controller_device_id: second,
      elapsed_seconds: 360,
      running_since: null,
    });
    expect(() => transition(
      handedOff,
      { type: "session.finish", payload: { id, device_id: first } },
      "2026-09-07T12:06:30Z",
    )).toThrow("Tomá el control");
    const resumed = transition(
      handedOff,
      { type: "session.resume", payload: { id, device_id: second } },
      "2026-09-07T12:10:00Z",
    );
    const finished = transition(
      resumed,
      { type: "session.finish", payload: { id, device_id: second } },
      "2026-09-07T12:12:00Z",
    );
    expect(finished.sessions.at(-1)?.actual_seconds).toBe(480);
    expect(finished.coins).toBe(initial.coins + 10);
  });
  it("stops an offline finish at the recorded time, not at reconnection", () => {
    const initial = fixture();
    const started = transition(
      initial,
      { type: "session.start", payload: { objective: "Repasar" } },
      "2026-09-07T12:00:00Z",
    );
    const id = started.activeSession!.id;
    const finished = transition(
      started,
      {
        type: "session.finish",
        payload: { id, finished_at: "2026-09-07T12:05:00Z" },
      },
      "2026-09-07T12:20:00Z",
    );
    expect(finished.sessions.at(-1)).toMatchObject({
      actual_seconds: 300,
      completed_at: "2026-09-07T12:05:00.000Z",
    });
    expect(finished.coins).toBe(initial.coins + 10);
    expect(() => transition(started, {
      type: "session.finish",
      payload: { id, finished_at: "2026-09-07T12:25:00Z" },
    }, "2026-09-07T12:20:00Z")).toThrow("hora del dispositivo");
  });
  it("does not award a session that was immediately closed or discarded", () => {
    const initial = fixture();
    const started = transition(
      initial,
      { type: "session.start", payload: { objective: "Leer un resumen" } },
      now,
    );
    const id = started.activeSession!.id;
    const short = transition(
      started,
      { type: "session.finish", payload: { id, feedback: "HARD" } },
      "2026-09-07T12:00:30Z",
    );
    expect(short.coins).toBe(initial.coins);
    expect(short.sessions[0].feedback).toBe("HARD");
    const discarded = transition(
      started,
      { type: "session.discard", payload: { id } },
      now,
    );
    expect(discarded.sessions).toEqual(initial.sessions);
    expect(discarded.activeSession).toBeNull();
  });
  it("binds planned study to an accepted slot and awards only after real elapsed time", () => {
    let s = fixture();
    s = transition(s, { type: "plan.propose", payload: {} }, now);
    const slot = s.plans[0].slots[0];
    expect(() =>
      transition(
        s,
        { type: "session.start", payload: { slot_id: slot.id } },
        now,
      ),
    ).toThrow("aceptado");
    s = transition(
      s,
      {
        type: "plan.accept",
        payload: { id: s.plans[0].id, version: s.plans[0].version },
      },
      now,
    );
    s = transition(
      s,
      { type: "session.start", payload: { slot_id: slot.id } },
      now,
    );
    expect(s.activeSession?.source).toBe("PLAN");
    const completed = transition(
      s,
      { type: "session.finish", payload: { id: s.activeSession!.id } },
      "2026-09-07T12:06:00Z",
    );
    expect(completed.plans[0].slots[0].status).toBe("COMPLETE");
    expect(completed.sessions[0]).toMatchObject({
      slot_id: slot.id,
      academic_item_id: slot.academic_item_id,
      actual_seconds: 360,
    });
  });
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
  it("keeps legacy planned completion idempotent without unverified rewards", () => {
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
    expect(s.coins).toBe(before);
    expect(s.sessions[0].actual_seconds).toBeUndefined();
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
  it("preserves balances for every check-in outcome, including accepted missed work and historical deductions", () => {
    for (const outcome of ["DONE", "PENDING", "EXCUSED", "UNCONFIRMED"]) {
      const s = fixture();
      s.coins = 37;
      s.checkins = [
        {
          id: "past",
          date: "2026-09-06",
          learned: "",
          news: "",
          outcome: "PENDING",
          deducted: 5,
        },
      ];
      s.plans = [
        {
          id: "accepted",
          version: 1,
          status: "ACCEPTED",
          created_at: now,
          unscheduled: [],
          slots: [
            {
              id: "slot",
              academic_item_id: s.items[0].id,
              date: "2026-09-07",
              start_minute: 1000,
              duration_minutes: 25,
              method_id: "retrieval",
              objective: "Practicar",
              status: "PENDING",
            },
          ],
        },
      ];
      const next = transition(
        s,
        {
          type: "checkin.save",
          payload: {
            learned: "",
            news: "",
            outcome,
            exception_reason: "Cambio de horario",
          },
        },
        now,
      );
      expect(next.coins).toBe(37);
      expect(next.checkins[0]).toEqual(s.checkins[0]);
      expect(next.checkins[1].deducted).toBe(0);
      expect(next.plans[0].slots[0].status).toBe(
        outcome === "EXCUSED"
          ? "EXCUSED"
          : outcome === "PENDING"
            ? "MISSED"
            : "PENDING",
      );
      if (outcome !== "UNCONFIRMED")
        expect(() =>
          transition(
            next,
            {
              type: "checkin.save",
              payload: { learned: "", news: "", outcome },
            },
            now,
          ),
        ).toThrow("registrado");
    }
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
  it("points home to the next study session when a block is pending", () => {
    const s = fixture();
    const date = today(s.profile?.timezone);
    s.plans = [
      {
        id: "plan-1",
        status: "ACCEPTED",
        version: 1,
        created_at: now,
        unscheduled: [],
        slots: [
          {
            id: "slot-1",
            academic_item_id: s.items[0].id,
            date,
            start_minute: 900,
            duration_minutes: 25,
            method_id: "retrieval",
            objective: "Recordar sin mirar",
            status: "PENDING",
          },
        ],
      },
    ];
    const action = nextStudyAction(s);
    expect(action.kind).toBe("start-session");
    expect(action.cta).toBe("Empezar sesión");
    expect(action.slot?.id).toBe("slot-1");
  });
  it("summarizes today's work in the student's timezone and orders remaining blocks", () => {
    const s = fixture();
    const date = "2026-09-23";
    s.items[0].due_date = date;
    s.items[1].due_date = "2026-09-22";
    s.sessions = [
      {
        id: "local-today",
        source: "FREE",
        method_id: "retrieval",
        duration_minutes: 20,
        reflection: "",
        completed_at: "2026-09-24T01:30:00Z",
      },
      {
        id: "local-tomorrow",
        source: "FREE",
        method_id: "retrieval",
        duration_minutes: 20,
        reflection: "",
        completed_at: "2026-09-24T04:00:00Z",
      },
    ];
    s.plans = [
      {
        id: "today-plan",
        status: "ACCEPTED",
        version: 1,
        created_at: now,
        unscheduled: [],
        slots: [
          {
            id: "later",
            academic_item_id: s.items[0].id,
            date,
            start_minute: 960,
            duration_minutes: 30,
            method_id: "retrieval",
            objective: "Segundo",
            status: "PENDING",
          },
          {
            id: "earlier",
            academic_item_id: s.items[0].id,
            date,
            start_minute: 900,
            duration_minutes: 20,
            method_id: "retrieval",
            objective: "Primero",
            status: "PENDING",
          },
        ],
      },
    ];
    const summary = homeSummary(s, "2026-09-24T02:00:00Z");
    expect(summary.date).toBe(date);
    expect(summary.completedSessions).toBe(1);
    expect(summary.progressSummary).toBe("1 sesión completada hoy");
    expect(summary.deadlineSummary).toBe("1 actividad con fecha anterior para revisar");
    expect(summary.dueToday.map((item) => item.id)).toEqual([s.items[0].id]);
    expect(summary.overdue.map((item) => item.id)).toEqual([s.items[1].id]);
    expect(summary.nextDue?.id).toBe(s.items[0].id);
    expect(summary.next?.id).toBe("earlier");
    expect(summary.minutes).toBe(50);
    s.items[1].status = "DONE";
    expect(homeSummary(s, "2026-09-24T02:00:00Z").deadlineSummary).toBe(
      "1 actividad vence hoy",
    );
    s.items[0].due_date = "2026-09-25";
    expect(homeSummary(s, "2026-09-24T02:00:00Z").deadlineSummary).toContain(
      "Próxima fecha: Practicar ecuaciones",
    );
  });
  it("lets a new learner start a free session without a subject or task", () => {
    const s = fixture();
    s.subjects = [];
    s.items = [];
    expect(nextStudyAction(s).kind).toBe("free-study");
    expect(prepareFreeStudy(s)).toEqual({
      subjectId: "",
      methodId: "retrieval",
      plannedMinutes: 25,
      remembered: false,
    });
  });
  it("shows an opted-in study routine only before studying on an enabled day", () => {
    const s = fixture();
    s.sessions = [];
    s.preferences.daily_study_enabled = true;
    s.preferences.daily_study_minute = 1050;
    s.preferences.weekends = false;
    expect(homeSummary(s, "2026-09-10T15:00:00Z").routineTime).toBe("17:30");
    expect(homeSummary(s, "2026-09-12T15:00:00Z").routineTime).toBeUndefined();
    s.sessions.push({
      id: "studied-today",
      source: "FREE",
      objective: "Repaso",
      method_id: "retrieval",
      duration_minutes: 20,
      completed_at: "2026-09-10T16:00:00Z",
    });
    expect(homeSummary(s, "2026-09-10T17:00:00Z").routineTime).toBeUndefined();
  });
  it("prepares free study from the latest free choice and ignores removed subjects", () => {
    const s = fixture();
    const subjectId = s.subjects[0].id;
    s.sessions.push({
      id: "free-1",
      source: "FREE",
      subject_id: subjectId,
      method_id: "practice-testing",
      duration_minutes: 18,
      planned_minutes: 30,
      reflection: "",
      completed_at: "2026-09-06T12:00:00Z",
    });
    s.sessions.push({
      id: "plan-1",
      source: "PLAN",
      method_id: "retrieval",
      duration_minutes: 25,
      planned_minutes: 25,
      reflection: "",
      completed_at: "2026-09-07T12:00:00Z",
    });
    expect(prepareFreeStudy(s)).toEqual({
      subjectId,
      methodId: "practice-testing",
      plannedMinutes: 30,
      remembered: true,
    });
    s.subjects = [];
    expect(prepareFreeStudy(s).subjectId).toBe("");
  });
  it("prepares a nearby activity for immediate study without accepting a plan", () => {
    const s = fixture();
    const instant = "2026-09-10T15:00:00Z";
    s.items[0].due_date = "2026-09-11";
    s.items[1].due_date = "2026-09-14";
    s.sessions.push({
      id: "previous-free",
      source: "FREE",
      subject_id: s.subjects[1].id,
      method_id: "practice-testing",
      duration_minutes: 28,
      planned_minutes: 30,
      reflection: "",
      completed_at: "2026-09-08T15:00:00Z",
    });
    const prepared = prepareDailyStudy(s, instant);
    expect(prepared).toMatchObject({
      objective: s.items[0].title,
      subjectId: s.items[0].subject_id,
      academicItemId: s.items[0].id,
      methodId: "practice-testing",
      plannedMinutes: 30,
      origin: "ACTIVITY",
    });
    expect(nextStudyAction(s, instant)).toMatchObject({
      kind: "free-study",
      cta: "Estudiar ahora",
    });
    const started = transition(
      s,
      {
        type: "session.start",
        payload: {
          academic_item_id: prepared.academicItemId,
          subject_id: prepared.subjectId,
          objective: prepared.objective,
          method_id: prepared.methodId,
          planned_minutes: prepared.plannedMinutes,
        },
      },
      instant,
    );
    expect(started.activeSession?.source).toBe("FREE");
    expect(started.activeSession?.academic_item_id).toBe(s.items[0].id);
    const finished = transition(
      started,
      { type: "session.finish", payload: { id: started.activeSession!.id } },
      "2026-09-10T15:10:00Z",
    );
    expect(finished.sessions.at(-1)?.academic_item_id).toBe(s.items[0].id);
    expect(finished.items[0].status).toBe("PENDING");
    expect(
      prepareDailyStudy(finished, "2026-09-10T15:11:00Z").academicItemId,
    ).toBe(s.items[1].id);
  });
  it("does not suggest distant tasks and rejects mismatched activity links", () => {
    const s = fixture();
    const instant = "2026-09-10T15:00:00Z";
    s.items.forEach((item) => (item.due_date = "2026-10-10"));
    s.sessions.push({
      id: "previous-free",
      source: "FREE",
      subject_id: s.subjects[0].id,
      method_id: "retrieval",
      duration_minutes: 20,
      reflection: "",
      completed_at: "2026-09-08T15:00:00Z",
    });
    expect(prepareDailyStudy(s, instant)).toMatchObject({
      objective: `Repasar ${s.subjects[0].name}`,
      academicItemId: undefined,
      origin: "RECENT",
    });
    expect(() =>
      transition(
        s,
        {
          type: "session.start",
          payload: {
            academic_item_id: s.items[0].id,
            subject_id: s.subjects[1].id,
            objective: "Otro tema",
          },
        },
        instant,
      ),
    ).toThrow("materia no corresponde");
  });
});
describe("consent records", () => {
  it("removes academic content from a revoked minor's ordinary snapshot without deleting it", () => {
    const state = demoSnapshot();
    state.profile!.birth_date = "2011-01-01";
    const consent = consentStatusFromRows("2011-01-01", [], true, "2026-09-25");
    const scoped = consentScopedSnapshot(state, consent);
    expect(scoped.subjects).toHaveLength(0);
    expect(scoped.messages).toHaveLength(0);
    expect(scoped.items).toHaveLength(0);
    expect(scoped.profile!.onboarding_complete).toBe(false);
    expect(state.subjects.length).toBeGreaterThan(0);
    expect(consentScopedSnapshot(state, { ...consent, recorded: true, capabilities: { service: true, ai: false, social: false } })).toBe(state);
  });
  it("rejects minor consent until the beta flag is on", () => {
    expect(() =>
      prepareConsentRecord(
        {
          policy_version: CONSENT_POLICY_VERSION,
          basis: "parental-guardian",
          guardian_name: "Ana Pérez",
          attestation: true,
        },
        "2012-03-01",
        false,
        "2026-09-17",
      ),
    ).toThrow("pendiente de habilitación");
  });
  it("prepares parental consent for independent verification", () => {
    const record = prepareConsentRecord(
      {
        policy_version: CONSENT_POLICY_VERSION,
        basis: "parental-guardian",
        guardian_name: "Ana Pérez",
        attestation: true,
      },
      "2012-03-01",
      true,
      "2026-09-17",
    );
    expect(record.evidence_reference).toBe("Ana Pérez");
    expect(
      consentStatusFromRows(
        "2012-03-01",
        [{ policy_version: CONSENT_POLICY_VERSION, verified_at: "2026-09-17" }],
        true,
        "2026-09-17",
      ),
    ).toMatchObject({ required: true, recorded: true, age: 14, capabilities: { service: false, ai: false, social: false } });
    expect(
      consentStatusFromRows(
        "2012-03-01",
        [{ policy_version: CONSENT_POLICY_VERSION, verified_at: null }],
        true,
        "2026-09-17",
      ),
    ).toMatchObject({
      required: true,
      recorded: false,
      pending: true,
      age: 14,
    });
    expect(consentStatusFromRows(
      "2012-03-01",
      [{ policy_version: CONSENT_POLICY_VERSION, verified_at: "2026-09-17", revoked_at: "2026-09-18" }],
      true,
      "2026-09-18",
    )).toMatchObject({ recorded: false, pending: false });
  });
});
