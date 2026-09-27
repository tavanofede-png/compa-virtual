import { useEffect, useState } from "react";
import { PixelRatio, View } from "react-native";
import * as Device from "expo-device";
import { useThree } from "@react-three/fiber/native";
import { cache } from "./storage";
import { Choices, Text, styles as st } from "./ui";

type Quality = "auto" | "light" | "detailed";
const listeners = new Set<() => void>();
const gib = 1024 ** 3;

/** Render resolution only: no authored objects or materials are removed. */
export function useSceneQuality() {
  const [quality, setQuality] = useState<Quality>("auto");
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const stored = await cache.getItem("compa.scene-quality");
      if (alive)
        setQuality(
          stored === "light" || stored === "detailed" ? stored : "auto",
        );
    };
    void sync();
    listeners.add(sync);
    return () => {
      alive = false;
      listeners.delete(sync);
    };
  }, []);
  const deviceRatio = PixelRatio.get();
  const memory = Device.totalMemory ?? 0;
  const pixelRatio =
    quality === "light"
      ? 1
      : quality === "detailed"
        ? Math.min(deviceRatio, 1.5)
        : memory > 0 && memory < 4 * gib
          ? 1
          : memory > 0 && memory < 6 * gib
            ? Math.min(deviceRatio, 1.25)
            : Math.min(deviceRatio, 1.5);
  return { quality, pixelRatio };
}

/** The native Canvas omits the web dpr prop; configure its renderer through the store. */
export function ScenePixelRatio({ ratio }: { ratio: number }) {
  const { setDpr, invalidate } = useThree();
  useEffect(() => {
    setDpr(ratio);
    invalidate();
  }, [setDpr, invalidate, ratio]);
  return null;
}

export function SceneQualityPreference() {
  const { quality } = useSceneQuality();
  return (
    <View style={{ gap: 4, paddingVertical: 12 }}>
      <Text style={st.h3}>Calidad de los espacios 3D</Text>
      <Text style={st.p}>
        Ajusta la nitidez. Los muebles y detalles de cada espacio se conservan.
      </Text>
      <Choices
        label="Calidad 3D"
        value={quality}
        options={[
          { value: "auto", label: "Automática" },
          { value: "light", label: "Liviana" },
          { value: "detailed", label: "Detallada" },
        ]}
        onChange={(value) => {
          void cache
            .setItem("compa.scene-quality", value)
            .then(() => listeners.forEach((notify) => notify()));
        }}
      />
    </View>
  );
}
