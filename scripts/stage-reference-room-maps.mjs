import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const mapsPath = resolve(root, "packages/world3d/src/room-maps.json");
const maps = JSON.parse(await readFile(mapsPath, "utf8"));
const configs = {
  "atico-creativo": {
    floor: 0.13,
    bounds: [-3.55, -2.67, 4.76, 2.67],
    spawn: [1.94, 0.13, 0.12],
    chairApproach: [1.96, 0.13, -0.36],
    bedApproach: [-0.75, 0.13, -1.02],
    shelf: ["V2_CubbySide", "V2_CubbySide.002"],
    obstacles: [
      ["easel", [0.05, -1.45], [1.02, -0.68]],
      ["missing-floor", [2.66, 0.44], [4.76, 2.67]],
    ],
    objects: [
      { id: "easel", label: "Mirar el caballete", position: [0.53, 1.35, -0.96], approach: [0.53, 0.13, -0.28], yaw: Math.PI },
      { id: "guitar", label: "Mirar la guitarra", position: [-3.04, 1.02, 1.08], approach: [-2.28, 0.13, 0.78], yaw: -Math.PI / 2 },
    ],
  },
  "rincon-urbano": {
    floor: 0.12,
    bounds: [-3.18, -2.67, 4.38, 2.67],
    spawn: [2.7, 0.12, 0],
    chairApproach: [1.36, 0.12, -0.35],
    bedApproach: [-0.3, 0.12, -1.02],
    shelf: ["Storage_BookcaseSide_2.95", "Storage_BookcaseSide_4.05"],
    obstacles: [["second-pouf", "CITY_SecondPouf"]],
    objects: [
      { id: "city-window", label: "Mirar la ciudad", position: [-3.06, 1.4, 1.25], approach: [-2.35, 0.12, 0.83], yaw: -Math.PI / 2 },
    ],
  },
  "sala-control-gamer": {
    floor: 0.12,
    bounds: [-3.18, -2.67, 4.38, 2.67],
    spawn: [2.7, 0.12, 0],
    chairApproach: [1.36, 0.12, -0.35],
    bedApproach: [-0.3, 0.12, -1.02],
    shelf: ["Storage_BookcaseSide_2.95", "Storage_BookcaseSide_4.05"],
    obstacles: [["equipment-chest", "GAMER_EquipmentChest_LeatherBody"]],
    objects: [
      { id: "equipment", label: "Mirar los controles", position: [-1.75, 0.65, 1.54], approach: [-1.75, 0.12, 0.82], yaw: 0 },
    ],
  },
  "habitacion-invernadero": {
    floor: 0.12,
    bounds: [-3.18, -2.67, 4.38, 2.67],
    spawn: [2.7, 0.12, -0.12],
    chairApproach: [1.36, 0.12, -0.35],
    bedApproach: [-0.3, 0.12, -1.02],
    shelf: ["Storage_BookcaseSide_2.95", "Storage_BookcaseSide_4.05"],
    obstacles: [
      ["fountain", [3.29, 0.98], [4.11, 1.8]],
      ["reading-cushion", "GARDEN_ReadingCushion"],
    ],
    objects: [
      { id: "fountain", label: "Mirar la fuente", position: [3.7, 0.73, 1.39], approach: [2.88, 0.12, 1.45], yaw: Math.PI / 2 },
      { id: "plants", label: "Observar las plantas", position: [-3.0, 1.0, 1.75], approach: [-2.24, 0.12, 0.85], yaw: -Math.PI / 2 },
    ],
  },
  "estudio-musical": {
    floor: 0.12,
    bounds: [-3.18, -2.67, 4.38, 2.67],
    spawn: [2.7, 0.12, 0],
    chairApproach: [1.36, 0.12, -0.35],
    bedApproach: [-0.3, 0.12, -1.02],
    shelf: ["Storage_BookcaseSide_2.95", "Storage_BookcaseSide_4.05"],
    obstacles: [["amplifier", "MUSIC_AmplifierCase_LeatherBody"]],
    objects: [
      { id: "amplifier", label: "Mirar el amplificador", position: [-1.63, 0.58, 1.46], approach: [-1.62, 0.12, 0.82], yaw: 0 },
      { id: "guitars", label: "Mirar las guitarras", position: [-1.25, 1.82, -2.29], approach: [-0.36, 0.12, -1.0], yaw: Math.PI },
    ],
  },
  "rincon-explorador": {
    floor: 0.12,
    bounds: [-3.18, -2.67, 4.38, 2.67],
    spawn: [2.7, 0.12, 0],
    chairApproach: [1.36, 0.12, -0.35],
    bedApproach: [-0.6, 0.12, -1.02],
    shelf: ["Storage_BookcaseSide_2.95", "Storage_BookcaseSide_4.05"],
    obstacles: [
      ["reading-seat", "EXP_ReadingSeat"],
      ["travel-trunk", "EXP_FootTravelTrunk_LeatherBody"],
      ["travel-cases", "EXP_StackedSuitcase_LeatherBody"],
    ],
    objects: [
      { id: "telescope", label: "Mirar el telescopio", position: [2.37, 1.55, -2.05], approach: [2.62, 0.12, -0.92], yaw: Math.PI },
      { id: "trunk", label: "Explorar el baúl", position: [-1.73, 0.6, 1.7], approach: [-1.7, 0.12, 0.87], yaw: 0 },
    ],
  },
};

const round = (value) => Math.round(value * 100) / 100;
for (const [id, config] of Object.entries(configs)) {
  const geometry = JSON.parse(await readFile(
    resolve(root, `apps/web/public/selection/models/${id}-geometry.json`), "utf8"));
  const source = new Map(geometry.obstacles.map((item) => [item.id, item]));
  const box = (names) => {
    const items = names.map((name) => {
      const item = source.get(name);
      if (!item) throw Error(`${id}: falta la geometría ${name}`);
      return item;
    });
    return {
      min: [round(Math.min(...items.map((item) => item.min[0]))), round(Math.min(...items.map((item) => item.min[1])))],
      max: [round(Math.max(...items.map((item) => item.max[0]))), round(Math.max(...items.map((item) => item.max[1])))],
    };
  };
  const furniture = (name) => {
    const value = geometry.furniture[name];
    if (!value) throw Error(`${id}: falta ${name}`);
    return value;
  };
  const chair = furniture("Desk_ChairSeat");
  const bed = furniture("Bed_Mattress");
  const pouf = furniture("Premium_Lounge_KnittedPouf");
  const chairX = round((chair[0][0] + chair[1][0]) / 2);
  const chairZ = round(-(chair[0][1] + chair[1][1]) / 2);
  const bedX = round((bed[0][0] + bed[1][0]) / 2);
  const bedZ = round(-(bed[0][1] + bed[1][1]) / 2);
  const poufX = round((pouf[0][0] + pouf[1][0]) / 2);
  const poufZ = round(-(pouf[0][1] + pouf[1][1]) / 2);
  const obstacles = [
    { id: "bed", ...box(["Bed_Frame", "Premium_Bed_QuiltedIvoryDuvet"]) },
    { id: "desk", ...box(["Desk_Worktop"]) },
    { id: "chair", ...box(["Desk_ChairSeat", "Desk_ChairBack"]) },
    { id: "pouf", ...box(["Premium_Lounge_KnittedPouf"]) },
    { id: "lounge-table", min: [0.14, 0.43], max: [1.02, 1.16] },
    { id: "bookcase", ...box(config.shelf) },
    { id: "bedside", ...box(["Premium_Bedside_RightCabinet"]) },
  ];
  for (const [name, first, last] of config.obstacles) {
    if (Array.isArray(first)) obstacles.push({ id: name, min: first, max: last });
    else obstacles.push({ id: name, ...box([first]) });
  }
  const floor = config.floor;
  const chairApproach = config.chairApproach;
  const bedApproach = config.bedApproach;
  const waypoints = [
    config.spawn,
    chairApproach,
    [0.86, floor, 0.08],
    ...(id === "rincon-explorador" ? [
      [1.46, floor, -0.03],
      [0.42, floor, 0.13],
      [-0.5, floor, 0.13],
      [-0.52, floor, -0.03],
      [-0.52, floor, -0.62],
    ] : []),
    bedApproach,
    [-1.35, floor, 0.84],
    [poufX, floor, 0.43],
    ...(id === "atico-creativo" ? [] : [[3.0, floor, 0.2]]),
  ];
  maps[id] = {
    version: 1,
    source: `${id}-review.blend`,
    floor,
    spawn: config.spawn,
    chair: {
      position: [chairX, round(chair[1][2]), chairZ],
      approach: chairApproach,
      yaw: Math.PI,
      height: round(chair[1][2]),
    },
    bed: {
      position: [bedX, round(bed[1][2]), bedZ],
      approach: bedApproach,
      yaw: Math.PI / 2,
      height: round(bed[1][2]),
    },
    bounds: config.bounds,
    obstacles,
    waypoints,
    stow: {
      chair: [chairX + 0.72, floor, chairZ + 0.38],
      bed: [bedApproach[0] + 0.18, floor, bedApproach[2] + 0.65],
    },
    pouf: {
      position: [poufX, round(pouf[1][2]), poufZ],
      approach: [poufX, floor, 0.43],
      yaw: 0,
      height: round(pouf[1][2]),
    },
    objects: config.objects,
  };
}
await writeFile(mapsPath, JSON.stringify(maps, null, 2) + "\n");
console.info(`Mapas de ${Object.keys(configs).length} dormitorios de referencia preparados.`);
