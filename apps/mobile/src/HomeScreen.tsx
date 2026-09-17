import { View, Pressable, StyleSheet } from "react-native";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import {
  homeSummary,
  dateLabel,
  localNow,
  isQuiet,
  activePet,
  type Snapshot,
} from "@compa/domain";
import { NativeRoom, NativeWorld } from "./Creature";
import { Text, Button, styles as st, colors } from "./ui";
export function TabIcon({
  id,
  active = false,
}: {
  id: string;
  active?: boolean;
}) {
  const stroke = active ? "#132239" : "#747989";
  return (
    <Svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {id === "room" ? (
        <Path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z" />
      ) : id === "agenda" ? (
        <>
          <Rect x={3} y={5} width={18} height={16} rx={3} />
          <Path d="M7 3v4m10-4v4M3 10h18M7 14h2m4 0h2m-8 3h2" />
        </>
      ) : id === "study" ? (
        <Path d="M12 5C7 2 3 4 3 4v16s4-2 9 1c5-3 9-1 9-1V4s-4-2-9 1v16" />
      ) : id === "progress" ? (
        <Path d="M8 3h8v8a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 3v6m-4 0h8" />
      ) : (
        <>
          <Circle cx={12} cy={7} r={4} />
          <Path d="M4 21v-3a8 8 0 0 1 16 0v3" />
        </>
      )}
    </Svg>
  );
}
type Props = {
  s: Snapshot;
  busy: boolean;
  open: (name: string, value?: unknown) => void;
  go: (name: string) => void;
  plan: () => void;
  visible?: boolean;
};
export function NativeHome({ s, busy, open, go, plan, visible = true }: Props) {
  const day = homeSummary(s),
    now = localNow(s.profile?.timezone);
  const pet = activePet(s);
  return (
    <View style={{ gap: 12 }}>
      <Text style={st.h1}>Hola, {s.profile?.nickname || "bienvenido"} 👋</Text>
      <Text style={[st.p, { letterSpacing: 1.4, fontSize: 13 }]}>
        TU MUNDO. TU MANERA DE APRENDER.
      </Text>
      <View style={{ marginHorizontal: -20 }}>
        <NativeRoom
          companion={s.companion}
          onTalk={() => open("chat")}
          height={390}
          active={visible}
          motionContext={{
            celebration: s.xp,
            resting: isQuiet(
              now.hour * 60 + now.minute,
              s.profile?.sleep_start ?? 1320,
              s.profile?.sleep_end ?? 420,
            ),
          }}
          petState={pet ? {
            definitionId: pet.petDefinitionId,
            instanceId: pet.id,
            name: pet.name,
            preferences: s.petPreferences,
            habitatId: s.equippedPetSetup.bedId,
            toyIds: s.equippedPetSetup.toyIds,
            accessoryId: s.equippedPetSetup.accessoryId ?? undefined,
          } : undefined}
        />
      </View>
      <View style={hs.today}>
        <View style={hs.heading}>
          <View>
            <Text style={hs.todayTitle}>HOY</Text>
            <Text style={hs.eyebrow}>PEQUEÑOS PASOS.{"\n"}GRANDES LOGROS.</Text>
          </View>
          <View style={hs.minutes}>
            <Text style={{ color: "#345cce", fontSize: 13 }}>
              Tu plan de hoy
            </Text>
            <Text style={{ fontWeight: "700", fontSize: 21 }}>
              {day.minutes} minutos
            </Text>
          </View>
        </View>
        {day.pending.slice(0, 2).map((item, i) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => open("item", item)}
            style={hs.activity}
          >
            <View
              style={[hs.tile, { backgroundColor: i ? "#4ba46c" : "#8860c6" }]}
            >
              <TabIcon id={item.kind === "EXAM" ? "study" : "agenda"} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 18, fontWeight: "600" }}>
                {s.subjects.find((x) => x.id === item.subject_id)?.name ||
                  item.title}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted }}>
                {dateLabel(item.due_date)}
              </Text>
            </View>
            <Text style={{ fontSize: 28, color: colors.muted }}>›</Text>
          </Pressable>
        ))}
        {!day.pending.length && (
          <View style={{ gap: 8, paddingVertical: 16 }}>
            <Text style={st.h2}>Hagamos lugar a tu primer paso.</Text>
            <Text style={st.p}>
              Sumá una materia y lo que tenés que hacer. Tu compa te ayuda a
              organizarlo.
            </Text>
          </View>
        )}
        <Button
          disabled={busy}
          onPress={() =>
            day.next
              ? open("focus", day.next)
              : !day.pending.length
                ? open(s.subjects.length ? "item" : "subjects")
                : day.plan
                  ? go("agenda")
                  : plan()
          }
        >
          {day.next
            ? "Empezar sesión →"
            : !day.pending.length
              ? "Agregar mi primera actividad →"
              : day.plan
                ? "Ver mi agenda →"
                : "Preparar mi plan →"}
        </Button>
        <Pressable
          onPress={() => go("today")}
          accessibilityRole="button"
          style={{
            minHeight: 48,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.muted }}>Ver mi día completo ›</Text>
        </Pressable>
      </View>
      <View style={{ gap: 10, paddingVertical: 22 }}>
        <Text style={st.h2}>¿Cómo viene tu día?</Text>
        <Text style={st.p}>Si algo cambió, podemos acomodar el plan.</Text>
        <Button secondary onPress={() => open("checkin")}>
          {day.checkedIn ? "Ver mi check-in" : "Hacer check-in"}
        </Button>
      </View>
    </View>
  );
}
export function NativeCompa({ s, open, go }: Pick<Props, "s" | "open" | "go">) {
  return (
    <View style={{ gap: 14 }}>
      <Text style={st.h1}>Tu compa, {s.companion.name}.</Text>
      <Text style={st.p}>Un espacio que también habla de vos.</Text>
      <View
        style={{
          height: 420,
          backgroundColor: "#f0e8df",
          borderRadius: 28,
          overflow: "hidden",
        }}
      >
        <NativeWorld companion={s.companion} />
      </View>
      <Button onPress={() => open("chat")}>
        Conversar con {s.companion.name}
      </Button>
      <Button secondary onPress={() => open("companion")}>
        Personaje, vestuario y habitación
      </Button>
      <Button secondary onPress={() => open("pet")}>
        {activePet(s) ? `Mi mascota: ${activePet(s)!.name}` : "Elegir mi mascota"}
      </Button>
      <Button secondary onPress={() => go("memory")}>
        Memoria académica
      </Button>
      <Button secondary onPress={() => go("notifications")}>
        Mis avisos
      </Button>
      <Button secondary onPress={() => open("settings")}>
        Mi cuenta y preferencias
      </Button>
    </View>
  );
}
const hs = StyleSheet.create({
  today: {
    backgroundColor: "#fffaf6",
    borderRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: "white",
    gap: 12,
  },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  todayTitle: { fontSize: 30, fontWeight: "700", letterSpacing: 3 },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.6,
    color: colors.muted,
    marginTop: 6,
    lineHeight: 20,
  },
  minutes: { padding: 12, borderRadius: 18, backgroundColor: "#dce9ff" },
  activity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: "#fffdfa",
  },
  tile: {
    width: 48,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
