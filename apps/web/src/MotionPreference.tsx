"use client";
import { useEffect, useState } from "react";
export function useMotionPreference() {
  const [enabled, setEnabled] = useState(false),
    [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReduced(media.matches);
      try {
        const saved = localStorage.getItem("compa.motion");
        setEnabled(saved === null ? !media.matches : saved === "on");
      } catch {
        setEnabled(!media.matches);
      }
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener("compa-motion", sync);
    window.addEventListener("storage", sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("compa-motion", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { enabled, reduced };
}
export function MotionPreference() {
  const { enabled, reduced } = useMotionPreference();
  return (
    <label className="motion-preference">
      <span>
        <strong>Movimiento del compañero</strong>
        <small>
          {reduced
            ? "El sistema solicita movimiento reducido. Los paseos automáticos están desactivados."
            : "Paseos y pequeñas rutinas dentro de tu habitación."}
        </small>
      </span>
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => {
          localStorage.setItem("compa.motion", e.target.checked ? "on" : "off");
          window.dispatchEvent(new Event("compa-motion"));
        }}
      />
    </label>
  );
}
