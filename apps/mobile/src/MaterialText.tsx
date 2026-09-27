import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import type { Repository, MaterialTextPage } from "@compa/client";
import { Button, Text, styles as st } from "./ui";

export function NativeMaterialText({ id, repo }: { id: string; repo: Repository }) {
  const [page, setPage] = useState<MaterialTextPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true; setBusy(true);
    void repo.materialText(id).then((result) => { if (alive.current) setPage(result); })
      .catch((failure) => { if (alive.current) setError(failure.message); })
      .finally(() => { if (alive.current) setBusy(false); });
    return () => { alive.current = false; };
  }, [id, repo]);
  const more = async () => {
    setBusy(true); setError("");
    try {
      const result = await repo.materialText(id, page?.nextCursor ?? -1);
      if (alive.current) setPage((previous) => ({ ...result, chunks: [...(previous?.chunks ?? []), ...result.chunks] }));
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "No pudimos leer el texto."); }
    finally { if (alive.current) setBusy(false); }
  };
  return <View style={{ gap: 16 }}>
    {page && <Text style={st.h3}>{page.title}</Text>}
    {page && !page.complete && <Text style={st.p}>Texto parcial. Algunas páginas necesitan OCR; podés consultar el original.</Text>}
    {!!error && <Text accessibilityRole="alert" style={st.error}>{error}</Text>}
    {page?.chunks.map((chunk) => <View key={chunk.ordinal}><Text style={st.h3}>{chunk.label}</Text><Text selectable style={st.p}>{chunk.content}</Text></View>)}
    {page && !page.chunks.length && <Text style={st.p}>Todavía no hay texto extraído. El original se abre desde Mis materiales.</Text>}
    {busy && <Text accessibilityLiveRegion="polite" style={st.p}>Cargando texto…</Text>}
    {(Boolean(page && page.nextCursor !== null) || error) && <Button secondary disabled={busy} onPress={() => void more()}>{error ? "Reintentar lectura" : "Ver más texto"}</Button>}
  </View>;
}
