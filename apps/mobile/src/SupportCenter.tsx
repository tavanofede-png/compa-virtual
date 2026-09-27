import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import type { Repository, SupportCategory, SupportTicket } from "@compa/client";
import { Button, Choices, Field, Text, colors } from "./ui";

const categories: { value: SupportCategory; label: string }[] = [
  { value: "access", label: "Acceso" }, { value: "study", label: "Estudio" },
  { value: "materials", label: "Archivos" }, { value: "rooms", label: "Espacios" },
  { value: "voice", label: "Voz" }, { value: "safety", label: "Seguridad" },
  { value: "other", label: "Otro" },
];
const statusLabel = { open: "Recibida", in_progress: "En revisión",
  waiting_student: "Esperando tu respuesta", resolved: "Resuelta" };
function page(rows: SupportTicket[]) {
  const visible = rows.slice(0, 50);
  const last = visible.at(-1);
  return { visible, next: rows.length > 50 && last ? { updated_at: last.updated_at, id: last.id } : null };
}

export function NativeSupportCenter({ repo }: { repo: Repository }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [cursor, setCursor] = useState<{ updated_at: string; id: string } | null>(null);
  const [category, setCategory] = useState<SupportCategory>("study");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [operation, setOperation] = useState(crypto.randomUUID());
  const [replyOperation, setReplyOperation] = useState(crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const result = page(await repo.supportTickets());
    setTickets(result.visible); setCursor(result.next);
  }, [repo]);
  const more = async () => {
    if (!cursor) return;
    const result = page(await repo.supportTickets(cursor));
    setTickets((current) => [...current, ...result.visible]); setCursor(result.next);
  };
  useEffect(() => { if (repo.mode === "live") void refresh().catch((failure) => setError(failure.message)); }, [refresh, repo.mode]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await action(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "No pudimos confirmar la operación."); }
    finally { setBusy(false); }
  };
  if (repo.mode !== "live") return <Text>El soporte se guarda únicamente en una cuenta conectada.</Text>;
  return <View style={{ gap: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: "700" }}>Ayuda y soporte</Text>
    <Text>Contanos qué ocurrió sin incluir contraseñas ni datos privados de otras personas. Revisamos las consultas desde el panel; no hay atención humana inmediata garantizada.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: "#a43720" }}>{error}</Text>}
    {!!notice && <Text accessibilityRole="summary" style={{ color: "#246344" }}>{notice}</Text>}
    <Text style={{ fontSize: 18, fontWeight: "700" }}>Nueva consulta</Text>
    <Choices label="Categoría" value={category} options={categories} onChange={(value) => setCategory(value as SupportCategory)} />
    <Field label="Asunto" value={subject} onChangeText={setSubject} maxLength={100} />
    <Field label="¿Qué pasó?" value={body} onChangeText={setBody} maxLength={2000} multiline />
    <Button disabled={busy || subject.trim().length < 4 || body.trim().length < 4}
      onPress={() => void run(async () => {
        await repo.createSupportTicket({ category, subject: subject.trim(), body: body.trim() }, operation);
        setOperation(crypto.randomUUID()); setSubject(""); setBody("");
        setNotice("Consulta recibida. Podés seguir su estado acá.");
        try { await refresh(); } catch { setNotice("Consulta recibida. Actualizá la lista para verla."); }
      })}>Enviar consulta</Button>
    <Text style={{ fontSize: 18, fontWeight: "700" }}>Mis consultas</Text>
    <Button secondary disabled={busy} onPress={() => void run(refresh)}>Actualizar</Button>
    {tickets.length === 0 && <Text>Todavía no hay consultas.</Text>}
    {tickets.map((ticket) => <View key={ticket.id} style={{ backgroundColor: "#fff", borderColor: colors.line,
      borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 }}>
      <Text style={{ fontWeight: "700" }}>{ticket.subject}</Text>
      <Text>{statusLabel[ticket.status]} · {new Date(ticket.created_at).toLocaleString("es-AR")}</Text>
      <Button secondary onPress={() => setSelected(selected === ticket.id ? null : ticket.id)}>
        {selected === ticket.id ? "Ocultar" : "Ver conversación"}
      </Button>
      {selected === ticket.id && <View style={{ gap: 12 }}>
        {ticket.messages.map((message) => <View key={message.id} style={{ padding: 12, backgroundColor: colors.bg, borderRadius: 12 }}>
          <Text style={{ fontWeight: "700" }}>{message.author_kind === "operator" ? "Equipo de Kusiy" : "Vos"}</Text>
          <Text>{message.body}</Text>
        </View>)}
        <Field label="Agregar información" value={reply} onChangeText={setReply} maxLength={2000} multiline />
        <Button secondary disabled={busy || reply.trim().length < 4} onPress={() => void run(async () => {
          await repo.replySupportTicket(ticket.id, reply.trim(), replyOperation);
          setReplyOperation(crypto.randomUUID()); setReply(""); setNotice("Respuesta recibida.");
          try { await refresh(); } catch { setNotice("Respuesta recibida. Actualizá la lista para verla."); }
        })}>Responder</Button>
      </View>}
    </View>)}
    {cursor && <Button secondary disabled={busy} onPress={() => void run(more)}>Cargar más consultas</Button>}
  </View>;
}
