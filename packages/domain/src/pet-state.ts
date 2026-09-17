import type { Snapshot } from "./types";
import { defaultPetPreferences, defaultPetSetup, petDefinition } from "./pets";

export function normalizePetState<T extends Snapshot>(state: T): T {
  state.ownedPets ??= [];
  state.activePetId ??= null;
  state.equippedPetSetup = { ...defaultPetSetup, ...state.equippedPetSetup, toyIds: state.equippedPetSetup?.toyIds ?? [...defaultPetSetup.toyIds] };
  state.petPreferences = { ...defaultPetPreferences, ...state.petPreferences };
  if (state.activePetId && !state.ownedPets.some((pet) => pet.id === state.activePetId)) {
    state.activePetId = null;
    state.equippedPetSetup.activePetId = null;
  }
  return state;
}

export function chooseFirstPet(state: Snapshot, name: string, now: string, instanceId: string = crypto.randomUUID()) {
  normalizePetState(state);
  if (state.ownedPets.length) return state.ownedPets[0];
  const definition = petDefinition("golden-retriever");
  const pet = { id: instanceId, petDefinitionId: definition.id, name: name.trim() || definition.name, acquiredAt: now, acquisition: "first-free" as const, accessories: ["pet-bandana-blue"], updatedAt: now };
  state.ownedPets.push(pet);
  state.activePetId = pet.id;
  state.equippedPetSetup.activePetId = pet.id;
  for (const item of ["pet-bed-cozy", "pet-bowl-cozy", "pet-toy-basket-cozy", "pet-ball-cozy", "pet-rope-cozy", "pet-bandana-blue"])
    if (!state.inventory.includes(item)) state.inventory.push(item);
  return pet;
}
