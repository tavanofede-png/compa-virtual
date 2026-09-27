"use client";
import { BookOpen, DoorOpen, Users } from "lucide-react";
import { useApp } from "./context";

export function StudyHubNav({ active }: { active: "study" | "spaces" | "together" }) {
  const { go } = useApp();
  const entries = [
    { id: "study", label: "Aprendizaje", icon: BookOpen },
    { id: "spaces", label: "Mis espacios", icon: DoorOpen },
    { id: "together", label: "Juntos", icon: Users },
  ] as const;
  return (
    <nav className="study-hub-nav" aria-label="Opciones para estudiar">
      {entries.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={active === id ? "active" : ""}
          aria-current={active === id ? "page" : undefined}
          onClick={() => go(id)}
        >
          <Icon size={18} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
