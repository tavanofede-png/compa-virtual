import { useEffect, useState } from "react";
import { Pressable, View, type ImageSourcePropType } from "react-native";
import { PreviewImage } from "./PreviewImage";
import {
  studySpaces,
  studySpaceById,
  type Companion,
  type StudySpaceId,
} from "@compa/domain";
import { Text, Button, colors, styles as st } from "./ui";
import { NativePersonalStudyScene } from "./PersonalStudyScene";
import { cache } from "./storage";

const previews: Record<StudySpaceId, ImageSourcePropType> = {
  library: require("../assets/selection/study-spaces/library.jpg"),
  terrace: require("../assets/selection/study-spaces/terrace.jpg"),
  pergola: require("../assets/selection/study-spaces/pergola.jpg"),
  cafe: require("../assets/selection/study-spaces/cafe.jpg"),
  minimal: require("../assets/selection/study-spaces/minimal.jpg"),
  tech: require("../assets/selection/study-spaces/tech.jpg"),
  pavilion: require("../assets/selection/study-spaces/pavilion.jpg"),
  loft: require("../assets/selection/study-spaces/loft.jpg"),
};

export function NativeStudyHubNav({
  active,
  go,
}: {
  active: "study" | "spaces" | "together";
  go: (view: string) => void;
}) {
  const entries = [
    ["study", "Aprendizaje"],
    ["spaces", "Mis espacios"],
    ["together", "Juntos"],
  ] as const;
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        padding: 5,
        borderRadius: 16,
        backgroundColor: "#eee9e2",
        gap: 5,
      }}
    >
      {entries.map(([id, label]) => (
        <Pressable
          key={id}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === id }}
          onPress={() => go(id)}
          style={{
            flex: 1,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 11,
            backgroundColor: active === id ? "#fffefa" : "transparent",
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: active === id ? "700" : "500",
              color: active === id ? colors.ink : colors.muted,
            }}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function NativeStudySpaces({
  go,
  open,
  activeId,
  companion,
  busy,
  selectSpace,
}: {
  go: (view: string) => void;
  open: (name: string) => void;
  activeId: StudySpaceId;
  companion: Companion;
  busy: boolean;
  selectSpace: (id: StudySpaceId) => Promise<void>;
}) {
  const [selected, setSelected] = useState<StudySpaceId>(activeId);
  const [entered, setEntered] = useState(false);
  const saved = studySpaceById(activeId).id;
  useEffect(() => {
    setSelected(saved);
  }, [saved]);
  useEffect(() => setEntered(false), [selected]);
  const current = studySpaceById(selected);
  return (
    <View style={{ gap: 16 }}>
      <NativeStudyHubNav active="spaces" go={go} />
      <View>
        <Text style={st.tag}>UN LUGAR PARA CADA FORMA DE PENSAR</Text>
        <Text style={st.h1}>Tus espacios de estudio.</Text>
        <Text style={st.p}>
          Ocho ambientes completos. Elegí dónde querés concentrarte hoy.
        </Text>
      </View>
      <View
        style={{
          overflow: "hidden",
          borderRadius: 24,
          backgroundColor: "#fffefa",
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        {entered ? (
          <NativePersonalStudyScene
            id={current.id}
            companion={companion}
            onInteract={(action) => {
              if (action === "session") open("focus");
              else if (action === "materials") open("upload");
              else if (action === "learning") go("study");
              else open("chat");
            }}
          />
        ) : (
          <PreviewImage
            source={previews[current.id]}
            aspectRatio={1.24}
            accessibilityLabel={current.name}
          />
        )}
        <View
          style={{
            padding: 20,
            borderTopWidth: 5,
            borderColor: current.accent,
            gap: 8,
          }}
        >
          <Text style={[st.tag, { color: current.accent }]}>
            ESPACIO SELECCIONADO
          </Text>
          <Text style={st.h2}>{current.name}</Text>
          <Text style={st.p}>{current.description}</Text>
          <Button secondary onPress={() => setEntered((value) => !value)}>
            {entered ? "Volver a la vista previa" : "Entrar al espacio 3D"}
          </Button>
          {entered && (
            <>
              <Button onPress={() => open("focus")}>Empezar sesión</Button>
              <Button secondary onPress={() => open("upload")}>
                Subir material
              </Button>
              <Button secondary onPress={() => go("study")}>
                Ver aprendizaje
              </Button>
            </>
          )}
          <Button
            disabled={busy || saved === selected}
            onPress={() => void selectSpace(selected)}
          >
            {saved === selected ? "Espacio activo ✓" : "Usar este espacio"}
          </Button>
        </View>
      </View>
      {studySpaces.map((space) => (
        <Pressable
          key={space.id}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === space.id }}
          onPress={() => setSelected(space.id)}
          style={{
            overflow: "hidden",
            borderRadius: 18,
            borderWidth: selected === space.id ? 2 : 1,
            borderColor: selected === space.id ? space.accent : colors.line,
            backgroundColor: "#fffefa",
          }}
        >
          <PreviewImage
            source={previews[space.id]}
            aspectRatio={1.45}
            accessibilityLabel={space.name}
          />
          <View style={{ padding: 15, gap: 5 }}>
            <Text style={st.h3}>
              {space.name}
              {saved === space.id ? "  ·  ACTIVO" : ""}
            </Text>
            <Text style={st.p}>{space.description}</Text>
          </View>
        </Pressable>
      ))}
      <Text style={[st.p, { textAlign: "center" }]}>
        Cada ambiente conserva una zona de estudio funcional y circulación para
        tu compañero. La escena se descarga cuando entrás.
      </Text>
    </View>
  );
}

export function NativeStudyView({
  id,
  companion,
}: {
  id: StudySpaceId;
  companion: Companion;
}) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let active = true;
    void cache.getItem("kusiy:study-view").then((value) => {
      if (active) setVisible(value === "room");
    });
    return () => {
      active = false;
    };
  }, []);
  const choose = (room: boolean) => {
    setVisible(room);
    void cache.setItem("kusiy:study-view", room ? "room" : "focus");
  };
  return (
    <View style={{ gap: 10 }}>
      <View
        style={{ flexDirection: "row", gap: 8 }}
        accessibilityLabel="Vista durante el estudio"
      >
        <Button secondary={visible} onPress={() => choose(false)}>
          Modo foco
        </Button>
        <Button secondary={!visible} onPress={() => choose(true)}>
          Ver habitación
        </Button>
      </View>
      {visible && <NativePersonalStudyScene id={id} companion={companion} />}
    </View>
  );
}
