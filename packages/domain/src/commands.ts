import { z } from "zod";
import { type Snapshot, catalog } from "./types";
import {
  profileSchema,
  itemSchema,
  blockSchema,
  companionSchema,
} from "./validation";
import { generatePlan } from "./planner";
import { methods } from "./methods";
import { today, addDays, localNow, isQuiet, weekday } from "./time";
import { chooseFirstPet, normalizePetState } from "./pet-state";
import { petDefinitions, petHabitats, petToys } from "./pets";
import { studySpaces } from "./study-spaces";
export interface Command {
  type: string;
  payload: unknown;
}
export class SessionControlConflict extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionControlConflict";
  }
}
const obj = z.record(z.string(), z.unknown());
const text = z.string().trim().min(1).max(4000);
const id = z.string().min(1).max(150);
export function transition(
  previous: Snapshot,
  command: Command,
  now: string,
): Snapshot {
  const s = normalizePetState(structuredClone(previous)),
    p = obj.parse(command.payload),
    uid = () => crypto.randomUUID();
  s.studyReminders ??= [];
  const current = today(s.profile?.timezone, now);
  const requireProfile = () => {
    if (!s.profile) throw Error("Completá tu perfil primero.");
    return s.profile;
  };
  const reward = (amount: number) => {
    s.coins += amount;
    s.xp += amount;
  };
  switch (command.type) {
    case "studySpace.select": {
      const value = z
        .object({ id: z.enum(studySpaces.map((space) => space.id)) })
        .parse(p);
      s.activeStudySpaceId = value.id;
      break;
    }
    case "onboarding.save":
    case "onboarding.complete": {
      const value = z
        .object({
          step: z.number().int().min(0).max(5),
          companion: companionSchema,
          profile: profileSchema.optional(),
          petName: z.string().trim().min(1).max(30).optional(),
        })
        .parse(p);
      if (!value.companion.character_id) throw Error("Elegí tu personaje.");
      if (
        ["accessory", "outfit", "decoration"].some(
          (k) =>
            value.companion[k as "accessory"] !== "none" &&
            !s.inventory.includes(value.companion[k as "accessory"]),
        )
      )
        throw Error("Ese objeto todavía no está desbloqueado.");
      const complete = command.type === "onboarding.complete";
      if (complete && !value.profile)
        throw Error("Completá tus datos para empezar.");
      if (value.profile)
        s.profile = {
          id: s.profile?.id ?? uid(),
          ...value.profile,
          onboarding_complete: complete,
        };
      else if (s.profile) s.profile.onboarding_complete = false;
      s.companion = { ...s.companion, ...value.companion };
      s.onboarding = { step: complete ? 5 : value.step, updated_at: now };
      if (complete && s.profile) {
        s.preferences.quiet_start = s.profile.sleep_start;
        s.preferences.quiet_end = s.profile.sleep_end;
        chooseFirstPet(s, value.petName ?? "Miel", now);
      }
      break;
    }
    case "profile.save":
      s.profile = { id: s.profile?.id ?? uid(), ...profileSchema.parse(p) };
      break;
    case "companion.save": {
      const next = companionSchema.parse(p);
      for (const key of ["accessory", "outfit", "decoration"] as const)
        if (next[key] !== "none" && !s.inventory.includes(next[key]))
          throw Error("Primero desbloqueá ese objeto.");
        else if (
          next[key] !== "none" &&
          !catalog.some(
            (item) => item.id === next[key] && item.category === key,
          )
        )
          throw Error("Ese objeto no corresponde a esta parte de tu compa.");
      s.companion = { ...s.companion, ...next };
      break;
    }
    case "pet.chooseFirst": {
      const value = z
        .object({ name: z.string().trim().min(1).max(30) })
        .parse(p);
      chooseFirstPet(s, value.name, now);
      break;
    }
    case "pet.unlock": {
      const value = z
        .object({
          definitionId: id,
          name: z.string().trim().min(1).max(30).optional(),
        })
        .parse(p);
      const definition = petDefinitions.find(
        (entry) => entry.id === value.definitionId,
      );
      if (
        !definition ||
        definition.unlock.kind !== "coins" ||
        typeof definition.unlock.value !== "number"
      )
        throw Error("Esa mascota todavía no se puede desbloquear.");
      const existing = s.ownedPets.find(
        (entry) => entry.petDefinitionId === definition.id,
      );
      if (existing) break;
      if (s.coins < definition.unlock.value)
        throw Error("Todavía no alcanzan las monedas.");
      s.coins -= definition.unlock.value;
      const pet = {
        id: uid(),
        petDefinitionId: definition.id,
        name: value.name ?? definition.name,
        acquiredAt: now,
        acquisition: "coins" as const,
        accessories: [],
        updatedAt: now,
      };
      s.ownedPets.push(pet);
      s.inventory = [...new Set([...s.inventory, `pet:${definition.id}`])];
      s.activePetId = pet.id;
      s.equippedPetSetup.activePetId = pet.id;
      break;
    }
    case "pet.rename": {
      const value = z
        .object({ id, name: z.string().trim().min(1).max(30) })
        .parse(p);
      const pet = s.ownedPets.find((entry) => entry.id === value.id);
      if (!pet) throw Error("Mascota no encontrada.");
      pet.name = value.name;
      pet.updatedAt = now;
      break;
    }
    case "pet.setActive": {
      const value = z.object({ id: id.nullable() }).parse(p);
      if (value.id && !s.ownedPets.some((pet) => pet.id === value.id))
        throw Error("Mascota no encontrada.");
      s.activePetId = value.id;
      s.equippedPetSetup.activePetId = value.id;
      break;
    }
    case "pet.equipAccessory": {
      const value = z
        .object({ id, accessoryId: z.string().max(80).nullable() })
        .parse(p);
      const pet = s.ownedPets.find((entry) => entry.id === value.id);
      if (!pet) throw Error("Mascota no encontrada.");
      const definition = petDefinitions.find(
        (entry) => entry.id === pet.petDefinitionId,
      );
      if (
        value.accessoryId &&
        (!s.inventory.includes(value.accessoryId) ||
          !definition?.compatibleAccessories.includes(value.accessoryId))
      )
        throw Error("Ese accesorio no está disponible para esta mascota.");
      pet.accessories = value.accessoryId ? [value.accessoryId] : [];
      pet.updatedAt = now;
      s.equippedPetSetup.accessoryId = value.accessoryId;
      break;
    }
    case "pet.placeHabitat": {
      const value = z
        .object({ bedId: id, toyIds: z.array(id).max(2) })
        .parse(p);
      if (
        !petHabitats.some((item) => item.id === value.bedId) ||
        value.toyIds.some((toy) => !petToys.some((item) => item.id === toy))
      )
        throw Error("Objeto de mascota desconocido.");
      if (
        ![value.bedId, ...value.toyIds].every((item) =>
          s.inventory.includes(item),
        )
      )
        throw Error("Ese objeto todavía no está desbloqueado.");
      s.equippedPetSetup = {
        ...s.equippedPetSetup,
        bedId: value.bedId,
        toyIds: value.toyIds,
      };
      break;
    }
    case "pet.setPreferences":
      s.petPreferences = z
        .object({
          visible: z.boolean(),
          automaticMovement: z.boolean(),
          activityLevel: z.enum(["calm", "normal", "active"]),
          reducedMotion: z.boolean(),
        })
        .parse(p);
      break;
    case "pet.configure": {
      const value = z
        .object({
          id,
          name: z.string().trim().min(1).max(30),
          visible: z.boolean(),
          automaticMovement: z.boolean(),
          activityLevel: z.enum(["calm", "normal", "active"]),
          reducedMotion: z.boolean(),
        })
        .parse(p);
      const pet = s.ownedPets.find((entry) => entry.id === value.id);
      if (!pet) throw Error("Mascota no encontrada.");
      pet.name = value.name;
      pet.updatedAt = now;
      s.petPreferences = {
        visible: value.visible,
        automaticMovement: value.automaticMovement,
        activityLevel: value.activityLevel,
        reducedMotion: value.reducedMotion,
      };
      break;
    }
    case "subject.save": {
      const value = z
        .object({
          id: id.optional(),
          name: z.string().trim().min(1).max(80),
          color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        })
        .parse(p);
      const existing = s.subjects.find((x) => x.id === value.id);
      if (value.id && !existing) throw Error("Materia no encontrada.");
      if (existing) Object.assign(existing, value);
      else s.subjects.push({ ...value, id: uid() });
      break;
    }
    case "block.save": {
      const value = blockSchema.parse(p);
      const existing = s.blocks.find((x) => x.id === p.id);
      if (p.id && !existing) throw Error("Horario no encontrado.");
      if (existing) Object.assign(existing, value);
      else s.blocks.push({ ...value, id: uid() });
      break;
    }
    case "block.delete":
      s.blocks = s.blocks.filter((x) => x.id !== id.parse(p.id));
      break;
    case "item.save": {
      const value = itemSchema.parse(p);
      if (!s.subjects.some((x) => x.id === value.subject_id))
        throw Error("Elegí una materia.");
      const existing = s.items.find((x) => x.id === p.id);
      if (p.id && !existing) throw Error("Actividad no encontrada.");
      if (existing) Object.assign(existing, value, { status: existing.status });
      else s.items.push({ ...value, status: "PENDING", id: uid() });
      break;
    }
    case "item.complete": {
      const item = s.items.find((x) => x.id === id.parse(p.id));
      if (!item) throw Error("Actividad no encontrada.");
      if (item.status === "DONE") break;
      item.status = "DONE";
      reward(5);
      break;
    }
    case "plan.propose": {
      const profile = requireProfile();
      const active = s.plans.find((x) => x.status === "ACCEPTED");
      const proposed = generatePlan({
        profile,
        items: s.items,
        blocks: s.blocks,
        sessions: s.sessions,
        now,
        locked: active?.slots.filter((x) => x.status === "PENDING"),
      });
      const planId = uid();
      s.plans = s.plans.filter((x) => x.status !== "PROPOSED");
      s.plans.push({
        id: planId,
        status: "PROPOSED",
        version: Math.max(0, ...s.plans.map((x) => x.version)) + 1,
        created_at: now,
        ...proposed,
        slots: proposed.slots.map((x) => ({
          ...x,
          id:
            planId +
            ":" +
            x.academic_item_id +
            ":" +
            x.date +
            ":" +
            x.start_minute,
        })),
      });
      break;
    }
    case "plan.accept": {
      const plan = s.plans.find((x) => x.id === p.id);
      if (!plan || plan.version !== p.version)
        throw Error("El plan cambió. Actualizá para revisarlo.");
      if (plan.status === "ACCEPTED") break;
      if (plan.status !== "PROPOSED") throw Error("Este plan fue reemplazado.");
      s.plans.forEach((x) => {
        if (x.status === "ACCEPTED") x.status = "SUPERSEDED";
      });
      plan.status = "ACCEPTED";
      break;
    }
    case "session.start": {
      const v = z
        .object({
          device_id: z.uuid().optional(),
          slot_id: id.optional(),
          academic_item_id: id.optional(),
          subject_id: id.optional(),
          objective: z.string().trim().min(1).max(240).optional(),
          method_id: id.default("retrieval"),
          planned_minutes: z.number().int().min(5).max(180).default(25),
        })
        .parse(p);
      requireProfile();
      if (s.activeSession)
        throw Error(
          "Ya hay una sesión en curso. Continuála o cerrala primero.",
        );
      let slot = undefined;
      if (v.slot_id) {
        slot = s.plans
          .find((plan) => plan.status === "ACCEPTED")
          ?.slots.find((entry) => entry.id === v.slot_id);
        if (!slot || slot.status !== "PENDING" || slot.date > current)
          throw Error("Este bloque no está disponible en el plan aceptado.");
      }
      if (slot && v.academic_item_id && v.academic_item_id !== slot.academic_item_id)
        throw Error("La actividad no corresponde a este bloque.");
      const item = slot
        ? s.items.find((entry) => entry.id === slot.academic_item_id)
        : v.academic_item_id
          ? s.items.find((entry) => entry.id === v.academic_item_id)
          : undefined;
      if (v.academic_item_id && (!item || item.status !== "PENDING"))
        throw Error("La actividad cambió. Actualizá antes de estudiar.");
      if (item && v.subject_id && item.subject_id !== v.subject_id)
        throw Error("La materia no corresponde a esta actividad.");
      if (
        v.subject_id &&
        !s.subjects.some((subject) => subject.id === v.subject_id)
      )
        throw Error("Materia no encontrada.");
      const methodId = slot?.method_id ?? v.method_id;
      if (!methods.some((method) => method.id === methodId))
        throw Error("Método de estudio no encontrado.");
      s.activeSession = {
        id: uid(),
        ...(v.device_id ? { controller_device_id: v.device_id } : {}),
        source: slot ? "PLAN" : "FREE",
        ...(slot
          ? { slot_id: slot.id, academic_item_id: slot.academic_item_id }
          : item
            ? { academic_item_id: item.id }
            : {}),
        ...(item?.subject_id || v.subject_id
          ? { subject_id: item?.subject_id ?? v.subject_id }
          : {}),
        objective: slot?.objective ?? v.objective ?? "",
        method_id: methodId,
        planned_minutes: slot?.duration_minutes ?? v.planned_minutes,
        started_at: now,
        running_since: now,
        elapsed_seconds: 0,
      };
      if (!s.activeSession.objective)
        throw Error("Contanos qué querés estudiar.");
      break;
    }
    case "session.takeControl": {
      const v = z.object({ id, device_id: z.uuid() }).parse(p);
      const active = s.activeSession;
      if (!active || active.id !== v.id)
        throw new SessionControlConflict("La sesión cambió. Actualizá para continuar.");
      if (active.controller_device_id !== v.device_id) {
        if (active.running_since) {
          active.elapsed_seconds += Math.max(
            0,
            Math.floor((Date.parse(now) - Date.parse(active.running_since)) / 1000),
          );
          active.running_since = null;
        }
        active.controller_device_id = v.device_id;
      }
      break;
    }
    case "session.pause":
    case "session.resume":
    case "session.finish":
    case "session.discard": {
      const v = z
        .object({
          id,
          device_id: z.uuid().optional(),
          feedback: z.enum(["EASY", "GOOD", "HARD", "VERY_HARD"]).optional(),
          reflection: z.string().trim().max(4000).optional(),
          finished_at: z.iso.datetime().optional(),
        })
        .parse(p);
      const active = s.activeSession;
      if (!active || active.id !== v.id) {
        if (
          command.type === "session.finish" &&
          s.sessions.some((session) => session.id === v.id)
        )
          break;
        throw new SessionControlConflict("La sesión cambió. Actualizá para continuar.");
      }
      if (
        active.controller_device_id &&
        active.controller_device_id !== v.device_id
      )
        throw new SessionControlConflict("Esta sesión se controla desde otro dispositivo. Tomá el control para continuar.");
      if (!active.controller_device_id && v.device_id)
        active.controller_device_id = v.device_id;
      let finishedAt = now;
      if (command.type === "session.finish" && v.finished_at) {
        const candidate = Date.parse(v.finished_at);
        if (
          candidate > Date.parse(now) + 60_000 ||
          candidate < Date.parse(active.started_at) - 60_000
        )
          throw Error("La hora del dispositivo no coincide con la sesión. Revisá la fecha y reintentá.");
        finishedAt = new Date(Math.min(candidate, Date.parse(now))).toISOString();
      }
      const segment = active.running_since
        ? Math.max(
            0,
            Math.floor(
              (Date.parse(command.type === "session.finish" ? finishedAt : now) -
                Date.parse(active.running_since)) / 1000,
            ),
          )
        : 0;
      if (command.type === "session.pause") {
        if (active.running_since) {
          active.elapsed_seconds += segment;
          active.running_since = null;
        }
        break;
      }
      if (command.type === "session.resume") {
        if (!active.running_since) active.running_since = now;
        break;
      }
      if (command.type === "session.discard") {
        s.activeSession = null;
        break;
      }
      const actualSeconds = active.elapsed_seconds + segment;
      const slot = active.slot_id
        ? s.plans
            .flatMap((plan) => plan.slots)
            .find((entry) => entry.id === active.slot_id)
        : undefined;
      if (active.source === "PLAN" && (!slot || slot.status !== "PENDING"))
        throw Error("El bloque cambió. Actualizá antes de cerrar la sesión.");
      if (slot) slot.status = "COMPLETE";
      s.sessions.push({
        id: active.id,
        ...(active.slot_id ? { slot_id: active.slot_id } : {}),
        ...(active.academic_item_id
          ? { academic_item_id: active.academic_item_id }
          : {}),
        ...(active.subject_id ? { subject_id: active.subject_id } : {}),
        objective: active.objective,
        source: active.source,
        method_id: active.method_id,
        duration_minutes: Math.floor(actualSeconds / 60),
        actual_seconds: actualSeconds,
        planned_minutes: active.planned_minutes,
        reflection: v.reflection ?? "",
        ...(v.feedback ? { feedback: v.feedback } : {}),
        started_at: active.started_at,
        completed_at: finishedAt,
      });
      s.activeSession = null;
      if (actualSeconds >= 300) reward(10);
      break;
    }
    case "session.complete": {
      const v = z
        .object({
          slot_id: id,
          reflection: z.string().trim().max(4000).default(""),
        })
        .parse(p);
      if (s.activeSession) throw Error("Cerrá la sesión en curso primero.");
      const plan = s.plans.find((x) => x.status === "ACCEPTED"),
        slot = plan?.slots.find((x) => x.id === v.slot_id);
      if (!slot)
        throw Error("Aceptá el plan vigente antes de registrar la sesión.");
      if (slot.status === "COMPLETE") break;
      if (slot.status !== "PENDING") throw Error("La sesión ya fue revisada.");
      if (slot.date > current)
        throw Error("Esta sesión está programada para otro día.");
      slot.status = "COMPLETE";
      s.sessions.push({
        id: uid(),
        slot_id: slot.id,
        academic_item_id: slot.academic_item_id,
        method_id: slot.method_id,
        duration_minutes: slot.duration_minutes,
        reflection: v.reflection,
        completed_at: now,
      });
      // Older clients can still close a planned block, but this command has
      // no start timestamp. Only the measured session.finish path earns coins.
      break;
    }
    case "checkin.save": {
      const v = z
        .object({
          learned: z.string().max(2000),
          news: z.string().max(2000),
          outcome: z.enum(["DONE", "PENDING", "EXCUSED", "UNCONFIRMED"]),
          exception_reason: z.string().max(1000).optional(),
        })
        .parse(p);
      const existing = s.checkins.find((x) => x.date === current);
      if (existing && existing.outcome !== "UNCONFIRMED")
        throw Error("El check-in de hoy ya está registrado.");
      if (v.outcome === "EXCUSED" && !v.exception_reason?.trim())
        throw Error("Contanos brevemente qué cambió.");
      const active = s.plans.find((x) => x.status === "ACCEPTED");
      const pending =
        active?.slots.filter(
          (x) => x.date === current && x.status === "PENDING",
        ) ?? [];
      // New check-ins preserve the balance. Historical ledger entries remain intact.
      const deducted = 0;
      if (v.outcome === "PENDING" || v.outcome === "EXCUSED")
        pending.forEach((x) => {
          x.status = v.outcome === "EXCUSED" ? "EXCUSED" : "MISSED";
        });
      if (existing) Object.assign(existing, v, { deducted });
      else s.checkins.push({ id: uid(), date: current, ...v, deducted });
      break;
    }
    case "memory.save": {
      const v = z
        .object({
          content: text,
          category: z.enum(["PREFERENCE", "TOPIC", "PROGRESS"]),
        })
        .parse(p);
      const existing = s.memories.find((x) => x.id === p.id);
      if (p.id && !existing) throw Error("Recuerdo no encontrado.");
      if (existing) Object.assign(existing, v, { updated_at: now, updated_by: "USER" });
      else {
        if (s.memories.length >= 100)
          throw Error("Tu memoria llegó a 100 recuerdos. Editá o eliminá uno antes de agregar otro.");
        s.memories.push({ id: uid(), ...v, origin: "MANUAL", created_at: now,
          updated_at: now, updated_by: "USER" });
      }
      break;
    }
    case "memory.delete":
      s.memories = s.memories.filter((x) => x.id !== id.parse(p.id));
      break;
    case "inventory.buy": {
      const item = catalog.find((x) => x.id === p.id);
      if (!item) throw Error("Objeto no encontrado.");
      if (s.inventory.includes(item.id)) break;
      if (s.coins < item.price) throw Error("Todavía no alcanzan las monedas.");
      s.coins -= item.price;
      s.inventory.push(item.id);
      break;
    }
    case "preferences.save":
      s.preferences = z
        .object({
          checkin_enabled: z.boolean(),
          checkin_minute: z.number().int().min(0).max(1439),
          daily_study_enabled: z.boolean().default(false),
          daily_study_minute: z.number().int().min(0).max(1439).default(1020),
          quiet_start: z.number().int().min(0).max(1439),
          quiet_end: z.number().int().min(0).max(1439),
          weekends: z.boolean(),
        })
        .parse(p);
      break;
    case "reminder.save": {
      const value = z
        .object({
          id: id.optional(),
          title: z.string().trim().min(1).max(120),
          body: z.string().trim().min(1).max(300),
          date: z.iso.date().nullable(),
          day_of_week: z.number().int().min(0).max(6).nullable(),
          minute: z.number().int().min(0).max(1439),
          route: z.enum([
            "room",
            "today",
            "agenda",
            "study",
            "progress",
            "compa",
            "spaces",
            "together",
          ]),
          enabled: z.boolean().default(true),
        })
        .parse(p);
      if ((value.date === null) === (value.day_of_week === null))
        throw Error(
          "Elegí una fecha puntual o un día semanal para el recordatorio.",
        );
      const existing = s.studyReminders.find((x) => x.id === value.id);
      if (value.id && !existing) throw Error("Recordatorio no encontrado.");
      if (existing) Object.assign(existing, value);
      else
        s.studyReminders.push({
          ...value,
          id: uid(),
          created_at: now,
        });
      break;
    }
    case "reminder.disable": {
      const reminder = s.studyReminders.find((x) => x.id === id.parse(p.id));
      if (!reminder) throw Error("Recordatorio no encontrado.");
      reminder.enabled = false;
      break;
    }
    case "quiz.submit": {
      const v = z
        .object({ id: id, answers: z.record(z.string(), z.string().max(4000)) })
        .parse(p);
      const quiz = s.quizzes.find((x) => x.id === v.id);
      if (!quiz) throw Error("Práctica no encontrada.");
      if (quiz.questions.some((q) => !v.answers[q.id]?.trim()))
        throw Error("Intentá responder todas las preguntas.");
      const normalize = (x: string) =>
        x
          .trim()
          .toLocaleLowerCase("es")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[.,!?¿¡]/g, "")
          .replace(/\s+/g, " ");
      const results = quiz.questions.map((q) => ({
        question_id: q.id,
        correct: normalize(v.answers[q.id]) === normalize(q.answer ?? ""),
        answer: q.answer ?? "",
        explanation: q.explanation ?? "",
      }));
      const prior = s.attempts.filter((x) => x.quiz_id === quiz.id),
        score = Math.round(
          (results.filter((x) => x.correct).length / results.length) * 100,
        );
      s.attempts.push({
        id: uid(),
        quiz_id: quiz.id,
        answers: v.answers,
        results,
        score,
        submitted_at: now,
      });
      if (!prior.length) reward(quiz.kind === "MOCK" ? 15 : 10);
      else if (
        !(s.correction_bonuses ?? []).includes(quiz.id) &&
        score > Math.max(...prior.map((a) => a.score))
      ) {
        reward(5);
        s.correction_bonuses = [...(s.correction_bonuses ?? []), quiz.id];
      }
      break;
    }
    case "flashcard.rate": {
      const value = z
        .object({ quiz_id: id, question_id: id, remembered: z.boolean() })
        .parse(p);
      const quiz = s.quizzes.find(
        (q) => q.id === value.quiz_id && q.kind === "FLASHCARDS",
      );
      if (!quiz?.questions.some((q) => q.id === value.question_id))
        throw Error("Tarjeta no encontrada.");
      const attempt = s.attempts.filter((a) => a.quiz_id === quiz.id).at(-1);
      if (!attempt)
        throw Error("Intentá responder antes de revisar la tarjeta.");
      const reviews = s.flashcard_reviews ?? [],
        previous = reviews.find(
          (r) => r.quiz_id === quiz.id && r.question_id === value.question_id,
        );
      if (previous?.attempt_id === attempt.id) break;
      const box = value.remembered ? Math.min(5, (previous?.box ?? 0) + 1) : 0;
      const review = {
        quiz_id: quiz.id,
        question_id: value.question_id,
        attempt_id: attempt.id,
        box,
        due_date: addDays(current, [1, 2, 4, 7, 14, 30][box]),
      };
      s.flashcard_reviews = [...reviews.filter((r) => r !== previous), review];
      break;
    }
    case "notification.read": {
      const n = s.notifications.find((x) => x.id === p.id);
      if (n) n.read_at = now;
      break;
    }
    case "notification.snooze": {
      const value = z
        .object({ id, minutes: z.union([z.literal(15), z.literal(30), z.literal(60)]) })
        .parse(p);
      const notification = s.notifications.find((x) => x.id === value.id);
      if (!notification) throw Error("Aviso no encontrado.");
      const route = z.enum([
        "room", "today", "agenda", "study", "progress", "compa",
        "spaces", "together",
      ]).parse(notification.route);
      const profile = requireProfile();
      let target = localNow(profile.timezone, now).add({ minutes: value.minutes });
      let available = false;
      for (let i = 0; i < 576; i++) {
        const date = target.toPlainDate().toString();
        const minute = target.hour * 60 + target.minute;
        const occupied = s.blocks.some((block) =>
          block.kind !== "AVAILABLE" &&
          (block.exception_date ? block.exception_date === date : block.day_of_week === weekday(date)) &&
          minute >= block.start_minute && minute < block.end_minute,
        );
        if (
          !isQuiet(minute, s.preferences.quiet_start, s.preferences.quiet_end) &&
          !isQuiet(minute, profile.sleep_start, profile.sleep_end) &&
          !occupied
        ) {
          available = true;
          break;
        }
        target = target.add({ minutes: 5 });
      }
      if (!available) throw Error("No encontramos un horario libre para posponer este aviso.");
      const reminder = s.studyReminders.find((x) => x.snoozed_from === notification.id);
      const fields = {
        title: notification.title,
        body: notification.body,
        date: target.toPlainDate().toString(),
        day_of_week: null,
        minute: target.hour * 60 + target.minute,
        route,
        enabled: true,
      };
      if (reminder) Object.assign(reminder, fields);
      else s.studyReminders.push({
        ...fields,
        id: uid(),
        created_at: now,
        snoozed_from: notification.id,
      });
      notification.read_at = now;
      break;
    }
    default:
      throw Error("Operación no reconocida.");
  }
  const dates = new Set([
    ...s.sessions.map((x) => today(s.profile?.timezone, x.completed_at)),
    ...s.attempts.map((x) => today(s.profile?.timezone, x.submitted_at)),
  ]);
  let date = dates.has(current) ? current : addDays(current, -1),
    streak = 0;
  while (dates.has(date)) {
    streak++;
    date = addDays(date, -1);
  }
  s.streak = streak;
  return s;
}
export function publicSnapshot(state: Snapshot): Snapshot {
  const s = normalizePetState(structuredClone(state));
  s.studyReminders ??= [];
  s.quizzes.forEach((q) =>
    q.questions.forEach((question) => {
      delete question.answer;
      delete question.explanation;
    }),
  );
  return s;
}
