"use client";
import { Check, DoorOpen, Sparkles } from "lucide-react";
import {
  studySpaces,
  studySpaceById,
  studySpacePreview,
  type StudySpaceId,
} from "@compa/domain";
import { useEffect, useState, type CSSProperties } from "react";
import { useApp } from "./context";
import { StudyHubNav } from "./StudyHubNav";
import { PersonalStudyCanvas } from "./PersonalStudyCanvas";

const storageKey = "kusiy:active-study-space";

export function StudySpaces() {
  const { env, run, command, busy, open, go } = useApp();
  const saved = studySpaceById(env.state.activeStudySpaceId).id;
  const [selected, setSelected] = useState<StudySpaceId>(saved);
  const [entered, setEntered] = useState(false);
  useEffect(() => setSelected(saved), [saved]);
  useEffect(() => setEntered(false), [selected]);
  useEffect(() => {
    const value = localStorage.getItem(storageKey);
    if (!env.state.activeStudySpaceId && value) {
      const space = studySpaceById(value);
      setSelected(space.id);
      if (space.id !== saved)
        void run(() => command("studySpace.select", { id: space.id }, false));
    }
  }, []);
  const current = studySpaceById(selected);
  return (
    <div className="study-spaces-page">
      <StudyHubNav active="spaces" />
      <header className="page-heading">
        <div>
          <p className="eyebrow">UN LUGAR PARA CADA FORMA DE PENSAR</p>
          <h1>Tus espacios de estudio.</h1>
          <p>Ocho ambientes completos. Elegí dónde querés concentrarte hoy.</p>
        </div>
        <button
          className="primary"
          disabled={busy || saved === selected}
          onClick={() =>
            void run(async () => {
              await command("studySpace.select", { id: selected }, false);
              localStorage.setItem(storageKey, selected);
            })
          }
        >
          {saved === selected ? <Check size={18} /> : <DoorOpen size={18} />}
          {saved === selected ? "Espacio activo" : "Usar este espacio"}
        </button>
      </header>
      <section
        className="study-space-feature"
        style={{ "--space-accent": current.accent } as CSSProperties}
      >
        {entered ? (
          <PersonalStudyCanvas
            id={current.id}
            companion={env.state.companion}
            onInteract={(action) => {
              if (action === "session") open("focus");
              else if (action === "materials") open("upload");
              else if (action === "learning") go("study");
              else open("chat");
            }}
          />
        ) : (
          <img src={studySpacePreview(current.id)} alt={`Vista detallada de ${current.name}`} />
        )}
        <div className="study-space-detail">
          <span className="study-space-kicker">
            <Sparkles size={15} /> ESPACIO SELECCIONADO
          </span>
          <h2>{current.name}</h2>
          <p>{current.description}</p>
          <strong>{current.atmosphere}</strong>
          <button className="secondary" type="button" onClick={() => setEntered((value) => !value)}>
            {entered ? "Volver a la vista previa" : "Entrar al espacio 3D"}
          </button>
          {entered && (
            <div className="study-space-actions" aria-label="Acciones del espacio de estudio">
              <button className="primary" type="button" onClick={() => open("focus")}>Empezar sesión</button>
              <button className="secondary" type="button" onClick={() => open("upload")}>Subir material</button>
              <button className="secondary" type="button" onClick={() => go("study")}>Ver aprendizaje</button>
            </div>
          )}
        </div>
      </section>
      <div
        className="study-space-grid"
        role="list"
        aria-label="Espacios disponibles"
      >
        {studySpaces.map((space) => (
          <button
            role="listitem"
            key={space.id}
            className={`study-space-card ${selected === space.id ? "selected" : ""}`}
            onClick={() => setSelected(space.id)}
            style={{ "--space-accent": space.accent } as CSSProperties}
          >
            <span className="study-space-image">
              <img src={studySpacePreview(space.id)} alt="" />
              {saved === space.id && (
                <span className="active-space-badge">
                  <Check size={14} /> ACTIVO
                </span>
              )}
            </span>
            <span className="study-space-copy">
              <strong>{space.name}</strong>
              <small>{space.description}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="study-space-note">
        Cada ambiente conserva una zona de estudio funcional y circulación para
        tu compañero. La escena 3D se descarga al entrar y puede tardar según tu conexión.
      </p>
    </div>
  );
}
