import type { ReactNode, FormEvent } from "react";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
export function Tag({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}
export const formData = (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget)) as Record<
    string,
    string
  >;
};
export const kinds: Record<string, string> = {
  TASK: "Tarea",
  EXAM: "Examen",
  PROJECT: "Proyecto",
  READING: "Lectura",
  PRESENTATION: "Presentación",
  HOMEWORK: "Ejercicios",
  OTHER: "Otra actividad",
};
export const days = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];
