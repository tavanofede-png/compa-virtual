import { describe, expect, it } from "vitest";
import { demoSnapshot, dueReminders } from "../packages/domain/src/index";
import {
  applyStudentAgentActions,
  buildStudentAgentContext,
  buildStudentAgentHistory,
  shouldRetrieveMaterialSources,
  studentAgentSchema,
  verifiedAgentContent,
} from "../packages/server/src/agent";

const instant = "2026-09-07T15:00:00Z";

describe("student agent", () => {
  it("keeps peer identities and meeting content out of provider context", () => {
    const state = demoSnapshot();
    state.preferences.daily_study_enabled = true;
    state.preferences.daily_study_minute = 1080;
    const context = buildStudentAgentContext(state, instant, {
      groups: [{ name: "Nombre privado", status: "ACTIVE", members: [{ nickname: "Persona ajena", role: "HOST" }] }],
      sessions: [{ id: "peer-session", title: "Tarea privada", objective: "Consigna de otra persona", status: "OPEN", participant_count: 3 }],
      invitations: [{ inviter: "Persona ajena", title: "Tarea privada", status: "PENDING", direction: "INCOMING" }],
    });
    const encoded = JSON.stringify(context);
    expect(encoded).not.toContain("Persona ajena");
    expect(encoded).not.toContain("Nombre privado");
    expect(encoded).not.toContain("Consigna de otra persona");
    expect(encoded).not.toContain("Tarea privada");
    expect(context.collaboration.groups[0]).toEqual({ status: "ACTIVE", member_count: 1 });
    expect(context.study_routine).toMatchObject({ enabled: true, minute: 1080 });
  });

  it("retrieves relevant memory within a bounded summary without mutating the account", () => {
    const state = demoSnapshot();
    state.memories = Array.from({ length: 100 }, (_, index) => ({
      id: `memory-${index}`, content: `Preferencia ${index} ${"x".repeat(3900)}`, category: "PREFERENCE" as const,
    }));
    state.memories[0].content = "Biología: prefiero repasar células usando tarjetas.";
    state.items = Array.from({ length: 150 }, (_, index) => ({ ...state.items[0], id: `activity-${index}`,
      description: "x".repeat(4000), title: `Actividad ${index}` }));
    state.items[0].title = "Biología: células";
    const previous = structuredClone(state);
    const context = buildStudentAgentContext(state, instant, null, "Quiero repasar Biología");
    expect(context.memories[0].id).toBe("memory-0");
    expect(context.activities[0].id).toBe("activity-0");
    expect(context.memories.length).toBeLessThanOrEqual(12);
    expect(context.activities.length).toBeLessThanOrEqual(30);
    expect(JSON.stringify(context).length).toBeLessThan(24000);
    expect(context.context_scope.activities).toEqual({ included: context.activities.length, total: 150 });
    expect(context.memories.some((memory) => memory.content_truncated)).toBe(true);
    expect(state).toEqual(previous);
  });

  it("sends bounded conversational text without replaying operation receipts", () => {
    const history = buildStudentAgentHistory(Array.from({ length: 30 }, (_, index) => ({
      id: `${index}`, role: "user" as const, created_at: instant, content: "a".repeat(4000),
      actions: [{ id: "operation", label: "Guardado", status: "COMPLETED" as const }],
    })));
    expect(history).toHaveLength(12);
    expect(history.every((message) => message.content.length === 1000 && message.content_truncated)).toBe(true);
    expect(history[0]).not.toHaveProperty("actions");
  });

  it("records a remember request's origin and preserves the student's daily routine", () => {
    const state = demoSnapshot();
    state.preferences.daily_study_enabled = true;
    state.preferences.daily_study_minute = 1080;
    const result = applyStudentAgentActions(state, [
      { type: "remember", content: "Prefiero sesiones cortas de Biología", category: "PREFERENCE" },
      { type: "set_notification_preferences", checkin_enabled: false, checkin_minute: 1140,
        quiet_start: 1320, quiet_end: 420, weekends: true },
    ], instant, "my-request-id");
    expect(result.state.memories.at(-1)).toMatchObject({ origin: "COMPANION", source_message_id: "my-request-id",
      created_at: instant, updated_by: "COMPANION" });
    expect(result.state.preferences).toMatchObject({ daily_study_enabled: true, daily_study_minute: 1080 });
  });

  it("changes the single daily reminder without creating duplicate weekly pushes", () => {
    const state = demoSnapshot();
    const enabled = applyStudentAgentActions(state, [
      { type: "set_study_routine", enabled: true, minute: 1080, weekends: false },
    ], instant);
    expect(enabled.state.preferences).toMatchObject({ daily_study_enabled: true, daily_study_minute: 1080 });
    expect(enabled.state.studyReminders).toEqual(state.studyReminders);
    const invalid = applyStudentAgentActions(enabled.state, [
      { type: "set_study_routine", enabled: true, minute: 1410, weekends: false },
    ], instant);
    expect(invalid.receipts[0].status).toBe("NEEDS_INPUT");
    expect(invalid.state.preferences).toEqual(enabled.state.preferences);
    const disabled = applyStudentAgentActions(enabled.state, [
      { type: "set_study_routine", enabled: false, minute: 1080, weekends: false },
    ], instant);
    expect(disabled.state.preferences.daily_study_enabled).toBe(false);
  });

  it("only searches uploaded sources when the message refers to them", () => {
    const materials = [
      { title: "Guía Rosamando - límites.pdf", status: "READY" as const },
    ];
    expect(shouldRetrieveMaterialSources("hola, ¿cómo estás?", materials)).toBe(
      false,
    );
    expect(
      shouldRetrieveMaterialSources(
        "creá una tarea para mañana a las 18",
        materials,
      ),
    ).toBe(false);
    expect(
      shouldRetrieveMaterialSources("explicame la guía Rosamando", materials),
    ).toBe(true);
    expect(
      shouldRetrieveMaterialSources("según el PDF, ¿qué entra?", materials),
    ).toBe(true);
    expect(
      shouldRetrieveMaterialSources("leé mi archivo", [
        { ...materials[0], status: "QUEUED" as const },
      ]),
    ).toBe(false);
  });

  it("receives the academic state without private material paths", () => {
    const state = demoSnapshot();
    state.materials.push({
      id: "material-1",
      subject_id: state.subjects[0].id,
      title: "Guía de funciones",
      path: "private/user/file.pdf",
      mime_type: "application/pdf",
      size: 1200,
      status: "READY",
      page_count: 4,
    });
    const context = buildStudentAgentContext(state, instant);
    expect(context.subjects).toEqual(state.subjects);
    expect(context.activities.length).toBeGreaterThan(0);
    expect(context.materials[0]).toMatchObject({
      title: "Guía de funciones",
      status: "READY",
    });
    expect(context.materials[0]).not.toHaveProperty("path");
    expect(context.available_study_spaces).toHaveLength(8);
  });

  it("creates the missing subject together with the requested task", () => {
    const state = demoSnapshot();
    state.subjects = [];
    state.items = [];
    const result = applyStudentAgentActions(
      state,
      [
        {
          type: "create_task",
          item_id: null,
          subject_name: "Matemáticas",
          title: "Práctica de límites",
          description: "Resolver ejercicios",
          kind: "TASK",
          due_date: "2026-09-22",
          due_time: "15:00",
          priority: 2,
          difficulty: 3,
          effort_minutes: 50,
          topics: ["Límites"],
        },
      ],
      "2026-09-21T15:00:00Z",
    );
    expect(result.state.subjects).toHaveLength(1);
    expect(result.state.items[0]).toMatchObject({
      subject_id: result.state.subjects[0].id,
      due_date: "2026-09-22",
      due_time: "15:00",
    });
    expect(result.receipts).toHaveLength(2);
    expect(
      result.receipts.every((receipt) => receipt.status === "COMPLETED"),
    ).toBe(true);
  });

  it("activates an existing study space in the persisted snapshot", () => {
    const state = demoSnapshot();
    const result = applyStudentAgentActions(
      state,
      [{ type: "select_study_space", space_id: "terrace" }],
      instant,
    );
    expect(result.state.activeStudySpaceId).toBe("terrace");
    expect(result.receipts[0].status).toBe("COMPLETED");
  });

  it("updates owned personalization and a subject through validated commands", () => {
    const state = demoSnapshot();
    const subject = state.subjects[0];
    const result = applyStudentAgentActions(
      state,
      [
        {
          type: "rename_subject",
          subject_id: subject.id,
          name: "Matemática avanzada",
        },
        { type: "rename_companion", name: "Milo II" },
        { type: "select_personal_room", room_id: "naturaleza" },
      ],
      instant,
    );
    expect(result.state.subjects[0].name).toBe("Matemática avanzada");
    expect(result.state.companion.name).toBe("Milo II");
    expect(result.state.companion.room_style).toBe("naturaleza");
    expect(
      result.receipts.every((receipt) => receipt.status === "COMPLETED"),
    ).toBe(true);
  });

  it("never repeats an unverified success claim from the model", () => {
    expect(
      verifiedAgentContent("Entendido. Agendé la práctica.", 1, [
        { id: "x", label: "No encontré la materia.", status: "NEEDS_INPUT" },
      ]),
    ).toContain("No pude completar");
    expect(verifiedAgentContent("Agregué Matemática.", 0, [])).toContain(
      "Todavía no hice cambios",
    );
  });

  it("creates a subject, task, habit reminder and editable memory", () => {
    const state = demoSnapshot();
    const result = applyStudentAgentActions(
      state,
      [
        { type: "create_subject", name: "Física" },
        {
          type: "create_task",
          item_id: null,
          subject_name: "Física",
          title: "Resolver guía de movimiento",
          description: "Ejercicios 1 al 5",
          kind: "HOMEWORK",
          due_date: "2026-09-10",
          due_time: "19:00",
          priority: 2,
          difficulty: 3,
          effort_minutes: 45,
          topics: ["Movimiento rectilíneo"],
        },
        {
          type: "create_schedule_block",
          label: "Hábito de Física",
          day_of_week: 2,
          start_minute: 1080,
          end_minute: 1125,
          kind: "AVAILABLE",
        },
        {
          type: "create_reminder",
          title: "Momento de Física",
          body: "Tu bloque de práctica está por empezar.",
          date: null,
          day_of_week: 2,
          minute: 1070,
          route: "study",
        },
        {
          type: "remember",
          content: "Prefiero estudiar Física en bloques cortos.",
          category: "PREFERENCE",
        },
      ],
      instant,
    );
    const physics = result.state.subjects.find((x) => x.name === "Física");
    expect(physics).toBeTruthy();
    expect(
      result.state.items.find((x) => x.title === "Resolver guía de movimiento"),
    ).toMatchObject({ subject_id: physics?.id, source: "AI_EXTRACTED" });
    expect(result.state.studyReminders[0]).toMatchObject({
      day_of_week: 2,
      route: "study",
      enabled: true,
    });
    expect(result.state.memories.at(-1)?.content).toContain("bloques cortos");
    expect(result.receipts.every((x) => x.status === "COMPLETED")).toBe(true);
  });

  it("reports an invalid action without claiming it was completed", () => {
    const state = demoSnapshot();
    const result = applyStudentAgentActions(
      state,
      [
        {
          type: "create_task",
          item_id: "missing-item",
          subject_name: "Materia inexistente",
          title: "Trabajo",
          description: "",
          kind: "TASK",
          due_date: "2026-09-10",
          due_time: null,
          priority: 2,
          difficulty: 2,
          effort_minutes: 30,
          topics: [],
        },
      ],
      instant,
    );
    expect(result.state.items).toEqual(state.items);
    expect(result.receipts[0]).toMatchObject({ status: "NEEDS_INPUT" });
  });

  it("does not confirm reminders that notification rules would suppress", () => {
    const state = demoSnapshot();
    const result = applyStudentAgentActions(
      state,
      [
        {
          type: "create_reminder",
          title: "Estudiar antes de dormir",
          body: "Abrí tu sesión.",
          date: null,
          day_of_week: 1,
          minute: 1410,
          route: "study",
        },
      ],
      instant,
    );
    expect(result.state.studyReminders).toHaveLength(0);
    expect(result.receipts[0]).toMatchObject({ status: "NEEDS_INPUT" });
    expect(result.receipts[0].label).toContain("descanso");
  });

  it("delivers a weekly agent reminder only in its local window", () => {
    const state = demoSnapshot();
    state.studyReminders = [
      {
        id: "habit-1",
        title: "Práctica breve",
        body: "Diez minutos para empezar.",
        date: null,
        day_of_week: 1,
        minute: 1080,
        route: "study",
        enabled: true,
        created_at: instant,
      },
    ];
    expect(
      dueReminders(state, "2026-09-07T21:05:00Z").map((x) => x.id),
    ).toContain("custom:habit-1");
    expect(
      dueReminders(state, "2026-09-07T22:00:00Z").map((x) => x.id),
    ).not.toContain("custom:habit-1");
  });

  it("does not expose destructive actions in the model contract", () => {
    expect(() =>
      studentAgentSchema.parse({
        content: "De acuerdo.",
        citations: [],
        actions: [{ type: "delete_account" }],
      }),
    ).toThrow();
  });
});
