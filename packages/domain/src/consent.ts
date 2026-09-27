import { z } from "zod";
import { ageAt } from "./time";
import { emptySnapshot, type Snapshot } from "./types";

export const CONSENT_POLICY_VERSION = "kusiy-beta-nov-2026";
export const consentBases = ["parental-guardian", "self-adult"] as const;
export type ConsentBasis = (typeof consentBases)[number];
export const capabilityNames = ["service", "ai", "social"] as const;
export type FamilyCapability = (typeof capabilityNames)[number];
export type FamilyPermissions = Record<FamilyCapability, boolean>;
export interface CapabilityGrant {
  id: string;
  user_id: string;
  consent_id: string;
  policy_version: string;
  capability: FamilyCapability;
  granted_at: string;
  revoked_at: string | null;
}
export const familyAcceptanceSchema = z.object({
  policy_version: z.literal(CONSENT_POLICY_VERSION),
  attestation: z.literal(true),
  permissions: z.object({ service: z.literal(true), ai: z.boolean(), social: z.boolean() }).strict(),
}).strict();

export interface ConsentStatus {
  policy_version: string;
  required: boolean;
  recorded: boolean;
  pending: boolean;
  minor_beta: boolean;
  age: number | null;
  capabilities?: FamilyPermissions;
}

export const consentRecordSchema = z.object({
  policy_version: z.literal(CONSENT_POLICY_VERSION),
  basis: z.enum(consentBases),
  guardian_name: z.string().trim().min(2).max(80).optional(),
  attestation: z.literal(true),
});

export function emptyConsentStatus(minorBeta = false): ConsentStatus {
  return {
    policy_version: CONSENT_POLICY_VERSION,
    required: false,
    recorded: false,
    pending: false,
    minor_beta: minorBeta,
    age: null,
    capabilities: { service: false, ai: false, social: false },
  };
}

export function consentRequirement(
  birthDate: string | null | undefined,
  asOf?: string,
): { required: boolean; age: number | null } {
  if (!birthDate) return { required: false, age: null };
  const age = ageAt(birthDate, asOf);
  return { required: age < 18, age };
}

export function consentStatusFromRows(
  birthDate: string | null | undefined,
  rows: { id?: string; policy_version: string; verified_at?: string | null; revoked_at?: string | null }[],
  minorBeta: boolean,
  asOf?: string,
  grants: CapabilityGrant[] = [],
): ConsentStatus {
  const { required, age } = consentRequirement(birthDate, asOf);
  const activeConsents = new Set(rows.filter((row) =>
    row.policy_version === CONSENT_POLICY_VERSION && row.verified_at && !row.revoked_at,
  ).map((row) => row.id));
  const granted = (capability: FamilyCapability) => (age !== null && !required) ||
    grants.some((grant) => grant.capability === capability && !grant.revoked_at &&
      grant.policy_version === CONSENT_POLICY_VERSION && activeConsents.has(grant.consent_id));
  const allowed = (capability: FamilyCapability) => granted("service") && granted(capability);
  return {
    policy_version: CONSENT_POLICY_VERSION,
    required,
    recorded: rows.some(
      (row) =>
        row.policy_version === CONSENT_POLICY_VERSION &&
        Boolean(row.verified_at) && !row.revoked_at,
    ),
    pending: rows.some(
      (row) =>
        row.policy_version === CONSENT_POLICY_VERSION &&
        !row.verified_at && !row.revoked_at,
    ),
    minor_beta: minorBeta,
    age,
    capabilities: { service: allowed("service"), ai: allowed("ai"), social: allowed("social") },
  };
}

export function prepareConsentRecord(
  payload: unknown,
  birthDate: string,
  minorBetaApproved: boolean,
  asOf?: string,
): { policy_version: string; basis: ConsentBasis; evidence_reference: string } {
  const value = consentRecordSchema.parse(payload);
  const { required, age } = consentRequirement(birthDate, asOf);
  if (age === null) throw Error("Completá tu perfil primero.");
  if (required) {
    if (!minorBetaApproved)
      throw Error(
        "La beta para menores aún está pendiente de habilitación. Un adulto de prueba puede continuar con 18 años o más.",
      );
    if (value.basis !== "parental-guardian")
      throw Error(
        "Para menores hace falta el consentimiento de un adulto responsable.",
      );
    if (!value.guardian_name)
      throw Error("Indicá el nombre de quien consiente.");
    return {
      policy_version: value.policy_version,
      basis: value.basis,
      evidence_reference: value.guardian_name,
    };
  }
  if (value.basis !== "self-adult")
    throw Error("Este consentimiento no corresponde a un perfil adulto.");
  return {
    policy_version: value.policy_version,
    basis: value.basis,
    evidence_reference: "self-adult",
  };
}

export function consentScopedSnapshot(state: Snapshot, consent: ConsentStatus): Snapshot {
  if (!consent.required || consent.minor_beta && consent.recorded && consent.capabilities?.service) return state;
  const restricted = emptySnapshot();
  if (state.profile) restricted.profile = { ...state.profile, onboarding_complete: false };
  restricted.companion = state.companion;
  restricted.onboarding = { step: 5, updated_at: state.onboarding?.updated_at ?? new Date().toISOString() };
  return restricted;
}

export const IA_UNAVAILABLE =
  "La IA no está disponible ahora. Podés seguir con tu plan, el timer y las prácticas que ya tengas.";
