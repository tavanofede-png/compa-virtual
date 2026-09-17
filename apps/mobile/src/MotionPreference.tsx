import { useEffect, useState } from "react";
import { AccessibilityInfo, Switch, View } from "react-native";
import { cache } from "./storage";
import { Text, styles as st } from "./ui";
const listeners = new Set<() => void>();
export function useMotionPreference() {
  const [enabled, setEnabled] = useState(false),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    const sync = async () => {
      const [reduce, value] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled(),
        cache.getItem("compa.motion"),
      ]);
      if (alive) {
        setReduced(reduce);
        setEnabled(value === null ? !reduce : value === "on");
      }
    };
    void sync();
    listeners.add(sync);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      () => void sync(),
    );
    return () => {
      alive = false;
      listeners.delete(sync);
      sub.remove();
    };
  }, []);
  return { enabled, reduced };
}
export function MotionPreference() {
  const { enabled, reduced } = useMotionPreference();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        paddingVertical: 14,
      }}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={st.h3}>Movimiento del compañero</Text>
        <Text style={st.p}>
          {reduced
            ? "El sistema solicita movimiento reducido."
            : "Paseos y pequeñas rutinas en tu habitación."}
        </Text>
      </View>
      <Switch
        accessibilityLabel="Movimiento del compañero"
        value={enabled}
        onValueChange={async (value) => {
          await cache.setItem("compa.motion", value ? "on" : "off");
          listeners.forEach((fn) => fn());
        }}
      />
    </View>
  );
}
