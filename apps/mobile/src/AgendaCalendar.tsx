import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import type { CollaborationRepository } from "@compa/client";
import {
  clock,
  dateLabel,
  methodById,
  today,
  type Snapshot,
  type GroupStudySession,
} from "@compa/domain";
import { Text, Button, Card, colors, styles as st } from "./ui";

const iso = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const sessionDate = (session: GroupStudySession) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: session.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(session.scheduled_start_at));
  const part = (type: "year" | "month" | "day") => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export function NativeAgendaCalendar({
  state,
  open,
  initialDate,
  collaboration,
  go,
}: {
  state: Snapshot;
  open: (name: string, value?: unknown) => void;
  initialDate?: string;
  collaboration?: CollaborationRepository;
  go?: (view: string) => void;
}) {
  const currentDate = initialDate ?? today(state.profile?.timezone);
  const initial = new Date(`${currentDate}T12:00:00`);
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selected, setSelected] = useState(currentDate);
  const [meetings, setMeetings] = useState<GroupStudySession[]>([]);
  useEffect(() => {
    let active = true;
    if (!collaboration) return;
    collaboration.overview().then((overview) => {
      if (active && overview.enabled) setMeetings(overview.sessions);
    }).catch(() => {});
    return () => { active = false; };
  }, [collaboration]);
  const plan = state.plans.find((entry) => entry.status === "ACCEPTED");
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    state.items.forEach((item) => map.set(item.due_date, (map.get(item.due_date) ?? 0) + 1));
    plan?.slots.forEach((slot) => map.set(slot.date, (map.get(slot.date) ?? 0) + 1));
    meetings.forEach((meeting) => {
      const date = sessionDate(meeting);
      map.set(date, (map.get(date) ?? 0) + 1);
    });
    return map;
  }, [state.items, plan, meetings]);
  const offset = (month.getDay() + 6) % 7;
  const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const value = new Date(start);
    value.setDate(start.getDate() + index);
    return value;
  });
  const items = state.items.filter((item) => item.due_date === selected);
  const slots = (plan?.slots ?? []).filter((slot) => slot.date === selected);
  const selectedMeetings = meetings.filter((meeting) => sessionDate(meeting) === selected);
  return (
    <View style={{ gap: 14 }}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Text style={[st.h2, { textTransform: "capitalize", flex: 1 }]}>{new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(month)}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Button secondary onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</Button>
            <Button secondary onPress={() => { setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1)); setSelected(currentDate); }}>Hoy</Button>
            <Button secondary onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</Button>
          </View>
        </View>
        <View style={{ flexDirection: "row", marginTop: 16 }}>
          {['L','M','X','J','V','S','D'].map((day) => <Text key={day} style={{ width: "14.2857%", textAlign: "center", color: colors.muted, fontSize: 11, fontWeight: "700" }}>{day}</Text>)}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 7 }}>
          {days.map((day) => {
            const value = iso(day);
            const count = counts.get(value) ?? 0;
            const active = selected === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={`${dateLabel(value)}${count ? `, ${count} actividades` : ""}`}
                onPress={() => setSelected(value)}
                style={{ width: "14.2857%", minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: active ? "#e5eddd" : "transparent", opacity: day.getMonth() === month.getMonth() ? 1 : 0.35 }}
              >
                <Text style={{ fontSize: 12, fontWeight: currentDate === value || active ? "700" : "400", color: colors.ink }}>{day.getDate()}</Text>
                {!!count && <View style={{ marginTop: 5, width: 7, height: 7, borderRadius: 4, backgroundColor: "#58775c" }} />}
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Text style={st.tag}>DÍA SELECCIONADO</Text>
      <Text style={st.h2}>{dateLabel(selected)}</Text>
      {!items.length && !slots.length && !selectedMeetings.length && <Card><Text style={st.p}>No hay nada programado para este día.</Text></Card>}
      {selectedMeetings.map((meeting) => (
        <Pressable key={meeting.id} onPress={() => go?.("together")}>
          <Card>
            <Text style={st.tag}>{new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: meeting.timezone }).format(new Date(meeting.scheduled_start_at))} · JUNTOS</Text>
            <Text style={st.h3}>{meeting.title}</Text>
            <Text style={st.p}>Encuentro grupal · {meeting.participant_count}/6 participantes</Text>
          </Card>
        </Pressable>
      ))}
      {slots.map((slot) => (
        <Pressable key={slot.id} onPress={() => slot.status === "PENDING" && open("focus", slot)}>
          <Card>
            <Text style={st.tag}>{clock(slot.start_minute)} · SESIÓN</Text>
            <Text style={st.h3}>{state.items.find((item) => item.id === slot.academic_item_id)?.title ?? "Sesión de estudio"}</Text>
            <Text style={st.p}>{methodById(slot.method_id).name} · {slot.duration_minutes} min</Text>
          </Card>
        </Pressable>
      ))}
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => open("item", item)}>
          <Card>
            <Text style={st.tag}>{item.status === "DONE" ? "HECHA" : item.due_time || "PENDIENTE"}</Text>
            <Text style={st.h3}>{item.title}</Text>
            <Text style={st.p}>{state.subjects.find((subject) => subject.id === item.subject_id)?.name ?? "Sin materia"}</Text>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
