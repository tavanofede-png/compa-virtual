"use client";
import { ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { clock, dateLabel, methodById, today, type GroupStudySession } from "@compa/domain";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "./context";
import { Empty, Tag, kinds } from "./ui";

const iso = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const monthName = (date: Date) =>
  new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
const sessionDate = (session: GroupStudySession) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: session.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(session.scheduled_start_at));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export function AgendaCalendar({ initialDate }: { initialDate?: string }) {
  const { env, open, repo, go } = useApp();
  const s = env.state;
  const currentDate = initialDate ?? today(s.profile?.timezone);
  const initial = new Date(`${currentDate}T12:00:00`);
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selected, setSelected] = useState(currentDate);
  const [meetings, setMeetings] = useState<GroupStudySession[]>([]);
  useEffect(() => {
    let active = true;
    if (!repo.collaboration) return;
    repo.collaboration
      .overview()
      .then((overview) => {
        if (active && overview.enabled) setMeetings(overview.sessions);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [repo]);
  const plan = s.plans.find((entry) => entry.status === "ACCEPTED");
  const counts = useMemo(() => {
    const result = new Map<string, { items: number; slots: number; meetings: number; colors: string[] }>();
    for (const item of s.items) {
      const entry = result.get(item.due_date) ?? { items: 0, slots: 0, meetings: 0, colors: [] };
      entry.items += 1;
      const color = s.subjects.find((subject) => subject.id === item.subject_id)?.color ?? "#69778d";
      if (!entry.colors.includes(color)) entry.colors.push(color);
      result.set(item.due_date, entry);
    }
    for (const slot of plan?.slots ?? []) {
      const entry = result.get(slot.date) ?? { items: 0, slots: 0, meetings: 0, colors: [] };
      entry.slots += 1;
      result.set(slot.date, entry);
    }
    for (const meeting of meetings) {
      const date = sessionDate(meeting);
      const entry = result.get(date) ?? { items: 0, slots: 0, meetings: 0, colors: [] };
      entry.meetings += 1;
      if (!entry.colors.includes("#8960c7")) entry.colors.push("#8960c7");
      result.set(date, entry);
    }
    return result;
  }, [s.items, s.subjects, plan, meetings]);
  const firstOffset = (month.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - firstOffset);
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
  const selectedItems = s.items.filter((item) => item.due_date === selected);
  const selectedSlots = (plan?.slots ?? []).filter((slot) => slot.date === selected);
  const selectedMeetings = meetings.filter((meeting) => sessionDate(meeting) === selected);
  return (
    <section className="agenda-calendar" aria-label="Calendario mensual">
      <div className="calendar-toolbar">
        <div>
          <p className="eyebrow">CALENDARIO</p>
          <h2>{monthName(month)}</h2>
        </div>
        <div className="calendar-controls">
          <button className="icon-button" aria-label="Mes anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft /></button>
          <button className="secondary" onClick={() => { setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1)); setSelected(currentDate); }}>Hoy</button>
          <button className="icon-button" aria-label="Mes siguiente" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight /></button>
        </div>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const value = iso(day);
          const marks = counts.get(value);
          const outside = day.getMonth() !== month.getMonth();
          return (
            <button
              key={value}
              className={`${outside ? "outside" : ""} ${selected === value ? "selected" : ""} ${currentDate === value ? "today" : ""}`}
              onClick={() => setSelected(value)}
              aria-label={`${dateLabel(value)}${marks ? `, ${marks.items + marks.slots + marks.meetings} actividades` : ""}`}
            >
              <span className="calendar-number">{day.getDate()}</span>
              <span className="calendar-marks">
                {marks?.colors.slice(0, 3).map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
                {!!marks?.slots && <i className="session-mark" />}
              </span>
              {!!marks && <small>{marks.items + marks.slots + marks.meetings}</small>}
            </button>
          );
        })}
      </div>
      <div className="calendar-day-detail">
        <div className="section-heading">
          <div><p className="eyebrow">DÍA SELECCIONADO</p><h2>{dateLabel(selected)}</h2></div>
          <span>{selectedItems.length + selectedSlots.length + selectedMeetings.length} actividades</span>
        </div>
        {!selectedItems.length && !selectedSlots.length && !selectedMeetings.length && <Empty>No hay nada programado para este día.</Empty>}
        {selectedMeetings.map((meeting) => (
          <button key={meeting.id} className="calendar-event meeting" onClick={() => go("together")}>
            <span className="calendar-event-time"><Clock3 size={17} />{new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: meeting.timezone }).format(new Date(meeting.scheduled_start_at))}</span>
            <span><strong>{meeting.title}</strong><small>Encuentro grupal · {meeting.participant_count}/6 participantes</small></span>
            <Tag>JUNTOS</Tag>
          </button>
        ))}
        {selectedSlots.map((slot) => (
          <button key={slot.id} className="calendar-event session" onClick={() => slot.status === "PENDING" && open("focus", slot)}>
            <span className="calendar-event-time"><Clock3 size={17} />{clock(slot.start_minute)}</span>
            <span><strong>{s.items.find((item) => item.id === slot.academic_item_id)?.title ?? "Sesión de estudio"}</strong><small>{methodById(slot.method_id).name} · {slot.duration_minutes} min</small></span>
            <Tag>{slot.status === "PENDING" ? "SESIÓN" : "COMPLETA"}</Tag>
          </button>
        ))}
        {selectedItems.map((item) => (
          <button key={item.id} className="calendar-event" onClick={() => open("item", item)}>
            <i style={{ background: s.subjects.find((subject) => subject.id === item.subject_id)?.color }} />
            <span><strong>{item.title}</strong><small>{s.subjects.find((subject) => subject.id === item.subject_id)?.name ?? "Sin materia"} · {kinds[item.kind]}</small></span>
            <Tag>{item.status === "DONE" ? "HECHA" : item.due_time || "PENDIENTE"}</Tag>
          </button>
        ))}
      </div>
    </section>
  );
}
