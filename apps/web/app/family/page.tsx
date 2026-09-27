import type { Metadata } from "next";
import FamilyAccess from "../../src/FamilyAccess";

export const metadata: Metadata = { title: "Kusiy · Permisos familiares", referrer: "no-referrer", robots: { index: false, follow: false } };
export default function FamilyPage() { return <FamilyAccess />; }
