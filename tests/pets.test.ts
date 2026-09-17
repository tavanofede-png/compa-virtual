import { describe, expect, it } from "vitest";
import {
  activePet,
  chooseFirstPet,
  emptySnapshot,
  normalizePetState,
  petAnimationSets,
  petDefinitions,
  transition,
} from "../packages/domain/src/index";
import { findRoomRoute, roomInteractions, roomPetMaps } from "../packages/world3d/src/index";

const now = "2026-09-12T12:00:00.000Z";

describe("mascotas", () => {
  it("publica las veinticuatro mascotas con identidad y animaciones compatibles", () => {
    expect(petDefinitions).toHaveLength(24);
    expect(new Set(petDefinitions.map((pet) => pet.id)).size).toBe(24);
    expect(new Set(petDefinitions.map((pet) => pet.variant.model)).size).toBe(24);
    for (const pet of petDefinitions) {
      expect(petAnimationSets.some((set) => set.id === pet.animationSetId), pet.id).toBe(true);
      expect(pet.description.length, pet.id).toBeGreaterThan(30);
    }
  });

  it("entrega una sola mascota inicial y sus objetos", () => {
    const state = emptySnapshot();
    chooseFirstPet(state, "Luna", now, "pet-one");
    chooseFirstPet(state, "Duplicada", now, "pet-two");
    expect(state.ownedPets).toHaveLength(1);
    expect(activePet(state)?.name).toBe("Luna");
    expect(state.inventory).toEqual(expect.arrayContaining([
      "pet-bed-cozy", "pet-ball-cozy", "pet-rope-cozy", "pet-bowl-cozy",
    ]));
  });

  it("normaliza cuentas anteriores sin inventar una mascota", () => {
    const legacy = emptySnapshot();
    delete (legacy as Partial<typeof legacy>).ownedPets;
    const normalized = normalizePetState(legacy);
    expect(normalized.ownedPets).toEqual([]);
    expect(normalized.petPreferences.automaticMovement).toBe(true);
  });

  it("guarda nombre y preferencias en una sola operación", () => {
    const state = emptySnapshot();
    chooseFirstPet(state, "Miel", now, "pet-one");
    const next = transition(state, { type: "pet.configure", payload: {
      id: "pet-one", name: "Nube", visible: true, automaticMovement: false,
      activityLevel: "calm", reducedMotion: true,
    } }, now);
    expect(activePet(next)?.name).toBe("Nube");
    expect(next.petPreferences).toMatchObject({ automaticMovement: false, activityLevel: "calm", reducedMotion: true });
  });

  it("desbloquea una raza una vez, descuenta monedas y la activa", () => {
    const state = emptySnapshot();
    state.coins = 500;
    chooseFirstPet(state, "Miel", now, "pet-one");
    const unlocked = transition(state, { type: "pet.unlock", payload: { definitionId: "corgi", name: "Chispa" } }, now);
    const repeated = transition(unlocked, { type: "pet.unlock", payload: { definitionId: "corgi" } }, now);
    expect(repeated.ownedPets.filter((pet) => pet.petDefinitionId === "corgi")).toHaveLength(1);
    expect(activePet(repeated)?.petDefinitionId).toBe("corgi");
    expect(repeated.coins).toBe(335);
  });

  it("conecta los puntos esenciales de cada habitación", () => {
    for (const [id, petMap] of Object.entries(roomPetMaps)) {
      const room = roomInteractions[id];
      expect(room, id).toBeDefined();
      for (const destination of [petMap.home.approach, petMap.play.approach, petMap.companionNear.approach])
        expect(findRoomRoute(petMap.spawn, destination, room), `${id} ${destination}`).not.toBeNull();
    }
  });
});
