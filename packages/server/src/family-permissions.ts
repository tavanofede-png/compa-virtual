import type { SupabaseClient } from "@supabase/supabase-js";
import { CONSENT_POLICY_VERSION, type FamilyCapability } from "@compa/domain";

export async function hasFamilyCapability(db: SupabaseClient, userId: string, capability: FamilyCapability) {
  const { data, error } = await db.rpc("family_capability_allowed", {
    p_user: userId, p_policy: CONSENT_POLICY_VERSION, p_capability: capability,
  });
  if (error) throw error;
  return data === true;
}

export async function hashFamilyToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createFamilyToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function familyPortalConfiguration(env: Record<string, string | undefined>) {
  if (env.FAMILY_PORTAL_ENABLED !== "true") return null;
  try {
    const terms = new URL(env.FAMILY_TERMS_URL ?? "");
    const privacy = new URL(env.FAMILY_PRIVACY_URL ?? "");
    const portal = new URL(env.FAMILY_PORTAL_URL ?? "https://kusiy.vercel.app/family");
    if ([terms, privacy, portal].some((url) => url.protocol !== "https:" || url.username || url.password || url.hash)) return null;
    return { terms_url: terms.href, privacy_url: privacy.href, portal_url: portal.href };
  } catch { return null; }
}
