"use client";
import { useEffect, useRef, useState } from "react";
import type { MaterialTextPage } from "@compa/client";
import { useApp } from "./context";

export function MaterialText({ id }: { id: string }) {
  const { repo } = useApp();
  const [page, setPage] = useState<MaterialTextPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    setBusy(true);
    void repo.materialText(id).then((result) => { if (alive.current) setPage(result); })
      .catch((failure) => { if (alive.current) setError(failure.message); })
      .finally(() => { if (alive.current) setBusy(false); });
    return () => { alive.current = false; };
  }, [id, repo]);
  const more = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await repo.materialText(id, page?.nextCursor ?? -1);
      if (alive.current) setPage((previous) => ({ ...result, chunks: [...(previous?.chunks ?? []), ...result.chunks] }));
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "No pudimos cargar el texto."); }
    finally { if (alive.current) setBusy(false); }
  };
  return <section className="material-text" aria-label="Texto extraído del material">
    {page && <h3>{page.title}</h3>}
    {page && !page.complete && <p className="callout">Texto parcial. Algunas páginas todavía necesitan reconocimiento de imagen; podés consultar el original.</p>}
    {error && <p role="alert">{error}</p>}
    {page?.chunks.map((chunk) => <article key={chunk.ordinal}><h4>{chunk.label}</h4><p>{chunk.content}</p></article>)}
    {page && !page.chunks.length && <p>Todavía no hay texto extraído. El archivo original se abre desde Mis materiales.</p>}
    {busy && <p role="status">Cargando texto…</p>}
    {(Boolean(page && page.nextCursor !== null) || error) && <button className="secondary" disabled={busy} onClick={() => void more()}>{error ? "Reintentar lectura" : "Ver más texto"}</button>}
  </section>;
}
