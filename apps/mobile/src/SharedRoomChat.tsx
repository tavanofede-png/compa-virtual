import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, StyleSheet, TextInput, View } from "react-native";
import type { CollaborationRepository } from "@compa/client";
import type { GroupChatMessage, GroupChatPage, GroupChatReportCategory } from "@compa/domain";
import { Button, Text } from "./ui";

export function NativeSharedRoomChat({ repo, sessionId, userId }: {
  repo: CollaborationRepository; sessionId: string; userId: string;
}) {
  const [page, setPage] = useState<GroupChatPage | null>(null);
  const [older, setOlder] = useState<GroupChatMessage[]>([]);
  const [olderCursor, setOlderCursor] = useState<GroupChatPage["next_cursor"] | undefined>(undefined);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setPage(await repo.chatPage(sessionId));
    setOlder([]);
    setOlderCursor(undefined);
  }, [repo, sessionId]);
  useEffect(() => {
    let alive = true;
    void refresh().catch((failure) => { if (alive) setError(failure.message); });
    const off = repo.subscribe?.(() => void refresh().catch(() => {}), () => {});
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh().catch(() => {});
    }, 15000);
    return () => { alive = false; off?.(); clearInterval(timer); };
  }, [repo, refresh]);
  const act = async (operation: () => Promise<unknown>, success: string) => {
    if (busy) return false;
    setBusy(true); setError(""); setNotice("");
    try { await operation(); setNotice(success); await refresh(); return true; }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos confirmar la acción."); return false; }
    finally { setBusy(false); }
  };
  const categories: [string, GroupChatReportCategory][] = [
    ["Acoso", "harassment"], ["Datos personales", "personal-data"],
    ["Contenido sexual", "sexual"], ["Violencia", "violence"], ["Otro", "other"],
  ];
  const messages = [...older, ...(page?.messages ?? [])]
    .filter((message, index, all) => all.findIndex((item) => item.id === message.id) === index)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  return <View style={styles.section} accessibilityLabel="Chat del encuentro">
    <Text style={styles.heading}>Chat del encuentro</Text>
    <Text>Solo lo ven quienes participan. Podés reportar o bloquear a una persona.</Text>
    {!!error && <Text style={styles.error}>{error}</Text>}
    {!!notice && <Text>{notice}</Text>}
    {(olderCursor === undefined ? page?.next_cursor : olderCursor) && <Button secondary disabled={busy} onPress={async () => {
      setBusy(true); setError("");
      try {
        const previous = await repo.chatPage(sessionId, (olderCursor === undefined ? page?.next_cursor : olderCursor)!);
        setOlder((items) => [...items, ...previous.messages]);
        setOlderCursor(previous.next_cursor);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos cargar mensajes anteriores."); }
      finally { setBusy(false); }
    }}>Ver mensajes anteriores</Button>}
    {messages.map((message) => <View key={message.id} style={styles.message}>
      <Text style={styles.author}>{message.author_id === userId ? "Vos" : message.author_name}</Text>
      <Text>{message.body}</Text>
      {message.status === "held" && <Text>En revisión. Todavía no lo ven los demás.</Text>}
      {message.author_id && message.author_id !== userId && <View style={styles.actions}>
        <Button secondary onPress={() => setReportId(message.id)}>Reportar</Button>
        <Button secondary onPress={() => Alert.alert("Bloquear persona", "Saldrás de la sala si ambos están dentro.", [
          { text: "Cancelar", style: "cancel" },
          { text: "Bloquear", style: "destructive", onPress: () => {
            void act(() => repo.chatBlock(message.author_id!), "Persona bloqueada.");
          } },
        ])}>Bloquear</Button>
      </View>}
      {reportId === message.id && <View style={styles.report}>
        <Text>Elegí el motivo del reporte</Text>
        {categories.map(([label, category]) => <Button key={category} secondary disabled={busy}
          onPress={async () => {
            if (await act(() => repo.chatReport(sessionId, message.id, category), "Reporte enviado para revisión."))
              setReportId(null);
          }}>{label}</Button>)}
        <Button secondary onPress={() => setReportId(null)}>Cancelar</Button>
      </View>}
    </View>)}
    {page && (page.enabled ? <View style={styles.compose}>
      <Text>Tu mensaje</Text>
      <TextInput style={styles.input} multiline maxLength={1000} value={body}
        onChangeText={setBody} accessibilityLabel="Tu mensaje del encuentro" />
      <Button disabled={busy || !body.trim()} onPress={async () => {
        const content = body.trim();
        if (await act(() => repo.chatSend(sessionId, content), "Mensaje enviado.")) setBody("");
      }}>Enviar</Button>
    </View> : <Text>El chat está en solo lectura mientras se prepara la moderación.</Text>)}
  </View>;
}
const styles = StyleSheet.create({
  section: { padding: 18, borderWidth: 1, borderColor: "#ddd7ca", borderRadius: 20, backgroundColor: "#fffdf8", gap: 10 },
  heading: { fontSize: 20, fontWeight: "700" },
  message: { borderTopWidth: 1, borderTopColor: "#e5e0d3", paddingVertical: 12, gap: 5 },
  author: { fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  report: { gap: 8, paddingTop: 8 },
  compose: { gap: 10 },
  input: { minHeight: 72, borderWidth: 1, borderColor: "#aaa", borderRadius: 12, padding: 10, textAlignVertical: "top" },
  error: { color: "#892e1e" },
});
