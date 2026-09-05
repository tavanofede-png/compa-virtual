import * as T from "three";
import type { Companion } from "@compa/domain";
import { Model, compact, type V3 } from "./primitives";
import { equipmentModel } from "./equipment";
import { curtain, duvet } from "./tailoring";
const wood = "#c79568",
  paleWood = "#dfb88d",
  cream = "#f4e8d4",
  navy = "#46516a";
function books(m: Model, origin: V3, count = 5, standing = true) {
  const colors = [
    "#718da0",
    "#d99978",
    "#b5b793",
    "#bca6c1",
    "#d9ba73",
    "#586982",
  ];
  for (let i = 0; i < count; i++) {
    const height = 0.23 + (i % 3) * 0.035;
    const pos: V3 = standing
      ? [origin[0] + i * 0.069, origin[1] + height / 2, origin[2]]
      : [origin[0] + (i % 2) * 0.025, origin[1] + i * 0.045, origin[2]];
    m.box(
      standing ? [0.057, height, 0.16] : [0.28, 0.034, 0.21],
      colors[i % colors.length],
      pos,
      0.005,
    );
    if (standing)
      m.box(
        [0.041, 0.008, 0.004],
        cream,
        [pos[0], pos[1] + 0.07, pos[2] + 0.083],
        0,
      );
    else
      m.box([0.254, 0.017, 0.006], cream, [pos[0], pos[1], pos[2] + 0.108], 0);
  }
}
function poster(kind: "planet" | "mountain" | "music") {
  const p = new Model();
  p.box([0.76, 0.92, 0.035], cream, [0, 0, 0], 0.007);
  p.box(
    [0.69, 0.85, 0.012],
    kind === "planet" ? "#374460" : kind === "music" ? "#c88780" : "#7b99a3",
    [0, 0, 0.024],
    0,
  );
  if (kind === "planet") {
    p.ball([0.17, 0.17, 0.015], "#d7b874", [0.05, 0.08, 0.044]);
    p.torus(0.24, 0.012, "#ede0bf", [0.04, 0.08, 0.062], [0, 0, -0.4]).scale.y =
      0.35;
    for (let i = 0; i < 12; i++)
      p.ball([0.009, 0.009, 0.004], cream, [
        Math.sin(i * 2.4) * 0.28,
        Math.cos(i * 1.8) * 0.35,
        0.04,
      ]);
  } else if (kind === "mountain") {
    p.ball([0.09, 0.09, 0.007], "#ead5a0", [0.17, 0.2, 0.04]);
    p.mesh(
      new T.ConeGeometry(0.28, 0.46, 3),
      "#4c6a79",
      [-0.07, -0.11, 0.04],
      [0, 0, 0.08],
    ).scale.z = 0.025;
    p.mesh(
      new T.ConeGeometry(0.2, 0.32, 3),
      "#b6c4bb",
      [0.17, -0.15, 0.045],
      [0, 0, -0.1],
    ).scale.z = 0.025;
  } else {
    for (let i = 0; i < 9; i++)
      p.box(
        [0.035, 0.1 + Math.abs(Math.sin(i)) * 0.32, 0.009],
        cream,
        [-0.24 + i * 0.06, -0.03, 0.04],
        0.012,
      );
    p.box([0.4, 0.017, 0.01], "#544958", [0, 0.29, 0.04], 0);
  }
  return p.group;
}
function chair() {
  const m = new Model();
  m.group.name = "desk-chair";
  m.cylinder(0.035, 0.05, 0.45, navy, [0, 0.27, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5,
      x = Math.sin(a) * 0.33,
      z = Math.cos(a) * 0.33;
    m.rod([0, 0.1, 0], [x, 0.075, z], 0.027, navy);
    m.ball([0.045, 0.045, 0.045], "#303744", [x, 0.05, z]);
  }
  m.box([0.63, 0.11, 0.56], "#9aa69e", [0, 0.53, 0], 0.075);
  m.box([0.62, 0.6, 0.13], "#8c9f97", [0, 0.87, -0.235], 0.06, [-0.08, 0, 0]);
  for (const side of [-1, 1]) {
    m.rod([side * 0.29, 0.53, -0.09], [side * 0.29, 0.76, -0.09], 0.023, navy);
    m.box([0.065, 0.045, 0.29], navy, [side * 0.29, 0.78, 0.015], 0.015);
  }
  return m.group;
}
function guitar() {
  const m = new Model();
  m.group.name = "acoustic-guitar";
  m.ball([0.23, 0.27, 0.065], "#c68c55", [0, 0.28, 0]);
  m.ball([0.18, 0.22, 0.065], "#c68c55", [0, 0.54, 0]);
  m.box([0.075, 0.57, 0.052], "#654736", [0, 0.98, 0], 0.005);
  m.box([0.12, 0.2, 0.06], wood, [0, 1.33, 0], 0.015, [0, 0, -0.1]);
  m.cylinder(
    0.075,
    0.075,
    0.008,
    "#514337",
    [0, 0.51, 0.066],
    [Math.PI / 2, 0, 0],
  );
  m.box([0.17, 0.035, 0.027], "#6b4b37", [0, 0.22, 0.07], 0.003);
  for (let i = 0; i < 4; i++)
    m.rod(
      [-0.023 + i * 0.015, 0.23, 0.087],
      [-0.023 + i * 0.015, 1.38, 0.046],
      0.0017,
      cream,
    );
  return m.group;
}
function skateboard() {
  const m = new Model();
  m.group.name = "skateboard";
  m.box([0.25, 0.72, 0.06], "#c88076", [0, 0.4, 0], 0.085);
  m.box([0.12, 0.52, 0.012], navy, [0, 0.4, 0.04], 0.025);
  for (const y of [0.19, 0.61]) {
    m.rod([-0.14, y, -0.045], [0.14, y, -0.045], 0.018, "#87949c");
    for (const x of [-0.14, 0.14])
      m.cylinder(
        0.038,
        0.038,
        0.033,
        cream,
        [x, y, -0.045],
        [0, 0, Math.PI / 2],
      );
  }
  return m.group;
}
export function roomModel(companion: Companion) {
  const m = new Model();
  m.group.name = "teen-bedroom";
  m.finish = "oak";
  // Open-front architectural cutaway. Both walls have thickness and visible edges.
  m.box([6.8, 0.22, 5.6], "#b98e72", [0, -0.12, 0], 0.06);
  for (let x = 0; x < 22; x++)
    for (let z = 0; z < 3; z++)
      m.box(
        [0.296, 0.035, 1.78],
        ["#d8b58f", "#dec09e", "#d1ae89"][x % 3],
        [-3.14 + x * 0.299, 0.01, -1.81 + z * 1.81],
        0.004,
      );
  m.finish = "paint";
  m.box([0.14, 3.12, 5.6], "#d6d2cc", [-3.35, 1.45, 0], 0.018);
  // Back-wall segments leave a real window opening.
  m.box([3.66, 3.12, 0.14], "#a9b8c2", [-1.59, 1.45, -2.75], 0.012);
  m.box([0.77, 3.12, 0.14], "#a9b8c2", [3.0, 1.45, -2.75], 0.012);
  m.box([2.36, 1.24, 0.14], "#a9b8c2", [1.42, 0.52, -2.75], 0.012);
  m.box([2.36, 0.63, 0.14], "#a9b8c2", [1.42, 2.72, -2.75], 0.012);
  m.box([0.2, 0.065, 5.62], cream, [-3.34, 3.01, 0], 0.013);
  m.box([6.82, 0.065, 0.2], cream, [0, 3.01, -2.75], 0.013);
  m.box([6.68, 0.12, 0.045], cream, [0, 0.085, -2.65], 0.006);
  m.box([0.045, 0.12, 5.43], cream, [-3.25, 0.085, 0], 0.006);
  const night = companion.room_theme === "night",
    day = companion.room_theme === "day";
  m.box(
    [2.32, 1.39, 0.045],
    night ? "#344b79" : day ? "#b7d7df" : "#e2bbb0",
    [1.42, 1.81, -2.82],
    0.001,
  );
  m.mesh(
    new T.SphereGeometry(0.18, 20, 12),
    night ? "#fff0c4" : "#ffe2a4",
    [1.88, 2.12, -2.779],
  ).scale.z = 0.1;
  for (let i = 0; i < 7; i++)
    m.box(
      [0.3, 0.19 + (i % 3) * 0.08, 0.03],
      night ? "#2d3f64" : "#8caaa9",
      [0.46 + i * 0.31, 1.22 + (i % 3) * 0.04, -2.78],
      0.002,
    );
  for (const x of [0.21, 1.42, 2.63])
    m.box([0.065, 1.48, 0.13], cream, [x, 1.81, -2.7], 0.008);
  for (const y of [1.08, 1.81, 2.54])
    m.box([2.48, 0.063, 0.13], cream, [1.42, y, -2.7], 0.008);
  m.box([2.63, 0.065, 0.31], paleWood, [1.42, 1.064, -2.61], 0.018);
  // Soft curtains with physical folds rather than a flat backdrop.
  m.rod([0.025, 2.7, -2.48], [2.83, 2.7, -2.48], 0.025, wood);
  curtain(m, 0.1, "#d4cab9");
  curtain(m, 2.75, "#d4cab9");
  // Bed, pillow stack, stitched duvet and folded throw.
  m.finish = "oak";
  m.box([1.57, 0.27, 3.0], wood, [-2.23, 0.3, -0.6], 0.06);
  for (const x of [-2.8, -1.66])
    for (const z of [-1.8, 0.59])
      m.box([0.115, 0.24, 0.115], "#8d6850", [x, 0.13, z], 0.01);
  m.box([1.55, 0.76, 0.13], paleWood, [-2.23, 0.54, -2.18], 0.05);
  for (let i = 0; i < 6; i++)
    m.box([0.017, 0.56, 0.018], wood, [-2.78 + i * 0.22, 0.55, -2.106], 0.001);
  m.finish = "fabric";
  m.box([1.5, 0.18, 2.91], cream, [-2.23, 0.52, -0.6], 0.095);
  m.box([1.5, 0.16, 2.03], "#637d89", [-2.23, 0.63, -0.05], 0.065);
  duvet(m, [-2.23, 0.743, -0.06], 1.6, 2.06, "#687f8d");
  m.box([1.55, 0.042, 0.45], "#dbc3ac", [-2.23, 0.779, 0.57], 0.025);
  for (let i = 0; i < 7; i++)
    m.box(
      [1.45, 0.011, 0.013],
      "#c5aa94",
      [-2.23, 0.804, 0.385 + i * 0.058],
      0.001,
    );
  for (const x of [-2.57, -1.91])
    m.box([0.63, 0.16, 0.43], cream, [x, 0.66, -1.72], 0.09, [
      0.02,
      0,
      x < -2.2 ? -0.07 : 0.07,
    ]);
  m.box(
    [0.45, 0.15, 0.38],
    "#c78879",
    [-2.22, 0.71, -1.34],
    0.07,
    [0, 0.12, 0.08],
  );
  // Bedside cabinet and reading lamp.
  m.finish = "oak";
  m.box([0.5, 0.62, 0.53], paleWood, [-1.08, 0.32, -1.78], 0.027);
  for (const y of [0.22, 0.45]) {
    m.box([0.45, 0.2, 0.025], cream, [-1.08, y, -1.5], 0.008);
    m.ball([0.027, 0.027, 0.02], wood, [-1.08, y, -1.473]);
  }
  m.add(
    equipmentModel("lamp", "#cfaa82"),
    [-1.08, 0.65, -1.8],
    [0, 0, 0],
    0.65,
  );
  // Study desk: monitor, keyboard, notebook, mug and pencil pot.
  m.finish = "oak";
  m.box([2.63, 0.09, 0.92], paleWood, [1.61, 0.94, -2.02], 0.032);
  m.finish = "metal";
  for (const x of [0.39, 2.83])
    for (const z of [-2.34, -1.7])
      m.box([0.075, 0.91, 0.075], navy, [x, 0.48, z], 0.015);
  m.finish = "paint";
  m.box([0.58, 0.63, 0.74], cream, [2.46, 0.58, -2.04], 0.025);
  for (const y of [0.37, 0.61, 0.81]) {
    m.box([0.51, 0.16, 0.02], "#e3d7c5", [2.46, y, -1.66], 0.007);
    m.box([0.16, 0.018, 0.017], navy, [2.46, y, -1.64], 0.004);
  }
  m.box([0.35, 0.027, 0.25], navy, [1.3, 1.003, -2.17], 0.018);
  m.rod([1.3, 1.01, -2.22], [1.3, 1.22, -2.22], 0.027, navy);
  m.box([1.05, 0.61, 0.055], "#384458", [1.3, 1.49, -2.24], 0.027);
  m.box(
    [0.965, 0.518, 0.012],
    night ? "#46627f" : "#b3ccc4",
    [1.3, 1.5, -2.203],
    0.008,
  );
  m.box([0.33, 0.36, 0.009], "#edf0dc", [1.02, 1.49, -2.192], 0.009);
  for (let i = 0; i < 5; i++)
    m.box(
      [0.24, 0.018, 0.006],
      "#a7b7b3",
      [1.02, 1.62 - i * 0.055, -2.182],
      0.002,
    );
  for (let i = 0; i < 3; i++)
    m.box(
      [0.41, 0.066, 0.009],
      ["#6c8f97", "#8eaaa2", "#dfbb80"][i],
      [1.54, 1.62 - i * 0.11, -2.192],
      0.008,
    );
  m.box([0.8, 0.027, 0.28], "#e8e2d4", [1.27, 1.015, -1.82], 0.01);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 10; c++)
      m.box(
        [0.053, 0.008, 0.043],
        "#a9b6b4",
        [0.948 + c * 0.071, 1.034, -1.903 + r * 0.073],
        0.003,
      );
  m.box([0.31, 0.007, 0.35], "#859da3", [1.98, 0.994, -1.82], 0.026);
  m.ball([0.046, 0.025, 0.071], cream, [1.97, 1.02, -1.8]);
  // Machined speaker cabinets, drivers and a closed laptop beside the monitor.
  for (const x of [0.6, 2.03]) {
    m.finish = "metal";
    m.box([0.19, 0.29, 0.17], "#353b40", [x, 1.135, -2.25], 0.024);
    for (const y of [1.07, 1.2]) {
      m.cylinder(
        0.054,
        0.054,
        0.012,
        "#151e24",
        [x, y, -2.158],
        [Math.PI / 2, 0, 0],
      );
      m.torus(0.046, 0.003, "#858a8c", [x, y, -2.146]);
      m.ball([0.022, 0.022, 0.013], "#41484d", [x, y, -2.141]);
    }
  }
  m.box(
    [0.43, 0.022, 0.3],
    "#8e9599",
    [2.38, 1.009, -2.15],
    0.011,
    [0, 0.08, 0],
  );
  m.finish = "paint";
  m.box(
    [0.3, 0.045, 0.36],
    "#d59379",
    [0.55, 1.012, -1.86],
    0.009,
    [0, 0.18, 0],
  );
  m.box([0.26, 0.012, 0.335], cream, [0.55, 1.04, -1.86], 0.004, [0, 0.18, 0]);
  m.rod([0.43, 1.064, -1.8], [0.6, 1.064, -2.0], 0.007, navy);
  m.cylinder(0.068, 0.06, 0.15, "#9baead", [2.65, 1.061, -2.28]);
  for (let i = 0; i < 5; i++)
    m.rod(
      [2.61 + i * 0.018, 1.11, -2.28],
      [2.6 + i * 0.023, 1.27 + (i % 2) * 0.025, -2.285],
      0.006,
      ["#d89b66", navy, "#c8796e"][i % 3],
    );
  m.finish = "ceramic";
  m.cylinder(0.055, 0.048, 0.115, cream, [2.38, 1.046, -1.83]);
  m.cylinder(0.047, 0.047, 0.004, "#584235", [2.38, 1.106, -1.83]);
  m.torus(0.038, 0.01, cream, [2.438, 1.07, -1.83], [0, Math.PI / 2, 0]);
  m.add(chair(), [1.39, 0, -0.9], [0, -0.15, 0]);
  // Corkboard: pinned schedule and small notes, no private data baked into art.
  m.finish = "paint";
  m.box([0.65, 0.86, 0.044], wood, [-0.34, 2.13, -2.643], 0.014);
  m.box([0.58, 0.79, 0.014], "#bca07f", [-0.34, 2.13, -2.613], 0.005);
  for (let i = 0; i < 5; i++) {
    const x = -0.49 + (i % 2) * 0.26,
      y = 2.35 - Math.floor(i / 2) * 0.24;
    m.box(
      [0.185, 0.19, 0.008],
      ["#efe4c5", "#d4dfa7", "#dfbdb5"][i % 3],
      [x, y, -2.6],
      0.003,
      [0, 0, (i % 2 ? 1 : -1) * 0.06],
    );
    m.ball([0.014, 0.014, 0.01], "#856e7e", [x, y + 0.067, -2.586]);
  }
  m.add(poster("planet"), [-2.21, 2.03, -2.63]);
  m.add(poster("music"), [-3.258, 2.15, -0.13], [0, Math.PI / 2, 0], 0.8);
  m.add(poster("mountain"), [-3.258, 2.19, 1.02], [0, Math.PI / 2, 0], 0.9);
  // Wall shelf and personal objects.
  m.box([0.43, 0.067, 1.7], paleWood, [-3.04, 1.35, 0.88], 0.014);
  m.add(equipmentModel("plant"), [-3.0, 1.388, 0.28], [0, 0, 0], 0.75);
  const shelfBooks = new Model();
  books(shelfBooks, [0, 0, 0], 6);
  m.add(shelfBooks.group, [-2.97, 1.389, 0.8], [0, Math.PI / 2, 0]);
  m.box([0.28, 0.26, 0.23], "#dfb18d", [-3.02, 1.52, 1.49], 0.025);
  m.box([0.017, 0.2, 0.017], "#f4dcc3", [-2.87, 1.52, 1.49], 0.002);
  // Rug, pouf, backpack, basketball and skateboard make the room lived-in.
  m.finish = "knit";
  m.box([2.76, 0.032, 2.06], "#e3d2b5", [0.44, 0.052, 0.77], 0.08);
  for (let i = 0; i < 4; i++)
    m.box(
      [2.56, 0.005, 0.048],
      i % 2 ? "#c08d78" : "#96a9a5",
      [0.44, 0.072, 0.06 + i * 0.46],
      0.003,
    );
  m.ball([0.46, 0.32, 0.43], "#b594b0", [2.48, 0.29, 0.87]);
  m.torus(0.36, 0.011, "#9c7796", [2.48, 0.5, 0.87], [Math.PI / 2, 0, 0]);
  // Tailored seam lines and tassels give textiles a readable construction.
  for (let i = 0; i < 28; i++)
    for (const side of [-1, 1])
      m.rod(
        [-0.86 + i * 0.096, 0.057, 0.77 + side * 1.03],
        [-0.87 + i * 0.096, 0.051, 0.77 + side * 1.13],
        0.005,
        "#c0b298",
      );
  m.finish = "paint";
  m.add(
    equipmentModel("backpack", "#567f87"),
    [-0.78, 0.3, 0.48],
    [0.08, -0.5, 0.08],
    1.1,
  );
  m.add(skateboard(), [-2.93, 0.01, 2.07], [0.1, 0.3, -0.2]);
  m.add(guitar(), [-3.03, 0.03, -0.31], [0, Math.PI / 2, -0.1], 0.77);
  m.ball([0.195, 0.195, 0.195], "#b7754b", [2.49, 0.21, 2.02]);
  for (const rot of [
    [0, 0, 0],
    [Math.PI / 2, 0, 0],
    [0, Math.PI / 2, 0],
  ] as V3[])
    m.torus(0.196, 0.006, "#65483c", [2.49, 0.21, 2.02], rot);
  m.box([0.74, 0.34, 0.48], "#b5b4b5", [-1.95, 0.2, 1.75], 0.044);
  m.box([0.62, 0.035, 0.38], "#8c9c9f", [-1.95, 0.38, 1.75], 0.03);
  m.box([0.48, 0.08, 0.29], cream, [-1.98, 0.417, 1.74], 0.025, [0, 0.08, 0]);
  // A second slim bookcase, books, plant and an extra place for earned decoration.
  m.finish = "oak";
  m.box([0.71, 0.87, 0.62], paleWood, [2.8, 0.45, -0.5], 0.025);
  for (const y of [0.15, 0.45, 0.8])
    m.box([0.64, 0.035, 0.56], cream, [2.8, y, -0.49], 0.005);
  books(m, [2.53, 0.475, -0.43], 7);
  books(m, [2.72, 0.19, -0.4], 3, false);
  m.add(
    equipmentModel(
      companion.decoration === "none" ? "plant" : companion.decoration,
    ),
    [2.8, 0.905, -0.5],
    [0, -0.1, 0],
    0.9,
  );
  // Warm string lights along the exposed back edge.
  // Fluted timber headboard backing and recessed architectural light channel.
  m.finish = "oak";
  for (let i = 0; i < 21; i++)
    m.box(
      [0.055, 1.19, 0.036],
      "#ab805e",
      [-3.06 + i * 0.077, 0.68, -2.655],
      0.009,
    );
  m.finish = "metal";
  m.box([1.68, 0.028, 0.03], "#5b5148", [-2.26, 1.295, -2.629], 0.004);
  m.mesh(
    new T.BoxGeometry(1.61, 0.01, 0.012),
    "#ffdc9f",
    [-2.26, 1.296, -2.605],
    [0, 0, 0],
    night ? 2 : 0.6,
  );
  // Fine construction details: outlets, drawer reveals and brass shelf supports.
  m.finish = "paint";
  for (const x of [0.12, 2.96]) {
    m.box([0.12, 0.11, 0.012], cream, [x, 0.41, -2.663], 0.01);
    for (const sx of [-0.022, 0.022])
      m.box([0.009, 0.028, 0.005], "#666663", [x + sx, 0.41, -2.653], 0.002);
  }
  m.finish = "metal";
  for (const z of [0.28, 1.5])
    m.rod([-3.22, 1.18, z], [-2.87, 1.315, z], 0.009, "#b99b66");
  m.finish = "paint";
  const cable: V3[] = [];
  for (let i = 0; i <= 24; i++)
    cable.push([
      -3.1 + i * 0.25,
      2.82 - Math.sin((i / 24) * Math.PI) * 0.15,
      -2.6,
    ]);
  m.tube(cable, 0.009, "#776b6c");
  for (let i = 0; i <= 24; i += 2) {
    const p = cable[i];
    m.rod(p, [p[0], p[1] - 0.08, p[2]], 0.004, "#776b6c");
    m.mesh(
      new T.SphereGeometry(0.026, 10, 8),
      "#ffe3a0",
      [p[0], p[1] - 0.103, p[2]],
      [0, 0, 0],
      night ? 1.3 : 0.3,
    );
  }
  return compact(m.group);
}
