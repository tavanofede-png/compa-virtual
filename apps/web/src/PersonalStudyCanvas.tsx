"use client";
import { useEffect, useRef, useState } from "react";
import type { Companion, StudySpaceId } from "@compa/domain";
import { studySpacePreview } from "@compa/domain";
import type { StudyObjectAction } from "@compa/world3d";
import type { Object3D } from "three";

export function PersonalStudyCanvas({
  id,
  companion,
  onInteract,
}: {
  id: StudySpaceId;
  companion: Companion;
  onInteract?: (action: StudyObjectAction) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const interactRef = useRef(onInteract);
  interactRef.current = onInteract;
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let alive = true;
    let cleanup = () => {};
    setError("");
    setReady(false);
    void (async () => {
      const T = await import("three");
      const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");
      const { createPersonalStudyWorld, studyObjectAction } = await import("@compa/world3d");
      if (!host.current || !alive) return;
      const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      host.current.appendChild(renderer.domElement);
      cleanup = () => {
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
      const world = await createPersonalStudyWorld(id, companion, undefined, abort.signal);
      if (!alive) {
        world.dispose();
        cleanup();
        return;
      }
      const controls = new OrbitControls(world.camera, renderer.domElement);
      controls.target.copy(world.target);
      controls.enablePan = false;
      controls.minDistance = 5;
      controls.maxDistance = 22;
      controls.minPolarAngle = 0.35;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.update();
      const raycaster = new T.Raycaster();
      const pointer = new T.Vector2();
      let downX = 0;
      let downY = 0;
      const onPointerDown = (event: PointerEvent) => {
        downX = event.clientX;
        downY = event.clientY;
      };
      const onPointerUp = (event: PointerEvent) => {
        if (Math.hypot(event.clientX - downX, event.clientY - downY) > 8) return;
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, world.camera);
        const hit = raycaster.intersectObjects(world.scene.children, true)[0];
        if (!hit) return;
        const names: string[] = [];
        for (let object: Object3D | null = hit.object; object && object !== world.scene; object = object.parent)
          names.push(object.name);
        const action = studyObjectAction(names);
        if (action) interactRef.current?.(action);
      };
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);
      const resize = new ResizeObserver(() => {
        if (!host.current) return;
        const { width, height } = host.current.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        world.camera.aspect = width / height;
        world.camera.updateProjectionMatrix();
      });
      resize.observe(host.current);
      let frame = 0;
      let last = 0;
      let inView = true;
      const observer = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        last = 0;
      });
      observer.observe(host.current);
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const render = (time: number) => {
        if (!alive) return;
        frame = requestAnimationFrame(render);
        if (document.hidden || !inView) {
          last = 0;
          return;
        }
        if (time - last < 1000 / 30) return;
        world.update(last ? (time - last) / 1000 : 0, reduced.matches);
        last = time;
        renderer.render(world.scene, world.camera);
      };
      frame = requestAnimationFrame(render);
      setReady(true);
      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        resize.disconnect();
        controls.dispose();
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        world.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      };
    })().catch((cause) => {
      if (alive) setError(cause instanceof Error ? cause.message : "No se pudo abrir el espacio 3D.");
      cleanup();
    });
    return () => {
      alive = false;
      abort.abort();
      cleanup();
    };
  }, [id, companion, retry]);
  return (
    <div className="personal-study-view">
      <img src={studySpacePreview(id)} alt="" aria-hidden="true" className={ready ? "personal-study-fallback hidden" : "personal-study-fallback"} />
      <div ref={host} className="personal-study-canvas" role="img" aria-label="Espacio de estudio 3D. Tocá el escritorio para estudiar, la notebook para tus materiales, los libros para aprender o a tu compañero para conversar. Las mismas acciones están disponibles fuera de la escena." />
      {!ready && !error && <span className="personal-study-status" role="status">Preparando el espacio 3D…</span>}
      {error && (
        <div className="personal-study-status" role="alert">
          <p>{error} La vista previa y los controles de estudio siguen disponibles.</p>
          <button type="button" className="secondary" onClick={() => setRetry((value) => value + 1)}>
            Reintentar 3D
          </button>
        </div>
      )}
    </div>
  );
}
