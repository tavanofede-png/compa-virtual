import * as T from "three";
export type Surface =
  | "paint"
  | "oak"
  | "fabric"
  | "knit"
  | "metal"
  | "ceramic"
  | "skin"
  | "hair"
  | "rubber";
const finish: Record<Surface, [number, number]> = {
  paint: [0.72, 0],
  oak: [0.46, 0],
  fabric: [0.96, 0],
  knit: [0.98, 0],
  metal: [0.25, 0.78],
  ceramic: [0.22, 0.04],
  skin: [0.55, 0],
  hair: [0.34, 0.08],
  rubber: [0.86, 0],
};
// Object-space microstructure: stable under orbiting and shared by WebGL / Expo GL.
// No image download or browser-only canvas API is needed.
export function surfaceMaterial(color: string, surface: Surface, glow = 0) {
  const [roughness, metalness] = finish[surface];
  const material = new T.MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    emissive: color,
    emissiveIntensity: glow,
    sheen: surface === "fabric" || surface === "knit" ? 0.45 : 0,
    sheenColor: new T.Color(color),
    sheenRoughness: 0.8,
    clearcoat: surface === "oak" ? 0.16 : surface === "ceramic" ? 0.28 : 0,
    clearcoatRoughness: 0.35,
  });
  material.name = surface + ":" + color;
  material.userData.surface = surface;
  if (["oak", "fabric", "knit", "paint", "hair"].includes(surface)) {
    material.customProgramCacheKey = () => "compa-material-v3:" + surface;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = "varying vec3 cvPosition;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\ncvPosition = position;",
      );
      shader.fragmentShader =
        "varying vec3 cvPosition;\n" + shader.fragmentShader;
      const pattern =
        surface === "oak"
          ? "sin(cvPosition.x*145.0 + sin(cvPosition.z*2.9)*4.0 + sin(cvPosition.z*13.0)*.55) * .045 + sin(cvPosition.x*513.0 + sin(cvPosition.z*8.0)*3.0)*.018"
          : surface === "hair"
            ? "sin(cvPosition.x*280.0 + cvPosition.y*19.0)*.035"
            : surface === "paint"
              ? "sin(cvPosition.x*419.0)*sin(cvPosition.y*367.0)*sin(cvPosition.z*331.0)*.012"
              : "sin(cvPosition.x*380.0)*sin((cvPosition.y+cvPosition.z)*410.0)*.045";
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nfloat cvGrain = " +
          pattern +
          ";\ncvGrain *= clamp(1.0-length(fwidth(cvPosition))*70.0,0.0,1.0);\ndiffuseColor.rgb *= 1.0 + cvGrain;",
      );
    };
  }
  return material;
}
