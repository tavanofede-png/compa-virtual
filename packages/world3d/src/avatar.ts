import * as T from "three";
import {
  avatarAppearance,
  skinTones,
  hairColors,
  clothingColors,
  type Companion,
} from "@compa/domain";
import { Model, compact, type V3 } from "./primitives";
import { equipmentModel } from "./equipment";
import { loft, hairLock } from "./tailoring";
export function avatarModel(companion: Companion) {
  const a = avatarAppearance(companion),
    skin = skinTones[a.skin_tone]?.color ?? skinTones[2].color;
  const hair = hairColors[a.hair_color]?.color ?? hairColors[1].color,
    cloth = clothingColors[a.clothing_color]?.color ?? clothingColors[0].color;
  const root = new T.Group();
  root.name = "teen-avatar";
  root.userData.appearance = a;
  const body = new Model(),
    head = new Model(),
    hairModel = new Model();
  body.group.name = "body";
  head.group.name = "head";
  hairModel.group.name = "hair:" + a.hair_style;
  body.finish = "fabric";
  head.finish = "skin";
  hairModel.finish = "hair";
  const dark = "#303747",
    denim = "#46556d",
    white = "#f4eee3";
  const shoulder =
    a.avatar_style === "girl"
      ? 0.255
      : a.avatar_style === "boy"
        ? 0.282
        : 0.268;
  // Covered, stylized adolescent proportions. Every presentation can use every hair/outfit.
  body.box([0.43, 0.2, 0.285], denim, [0, 0.9, 0], 0.06);
  for (const side of [-1, 1]) {
    body.mesh(
      loft([
        { y: 0.1, x: 0.082, z: 0.1 },
        { y: 0.14, x: 0.092, z: 0.114 },
        { y: 0.3, x: 0.087, z: 0.1, offset: 0.008 },
        { y: 0.43, x: 0.09, z: 0.118, offset: 0.02 },
        { y: 0.5, x: 0.089, z: 0.122, offset: 0.01 },
        { y: 0.67, x: 0.104, z: 0.13 },
        { y: 0.84, x: 0.112, z: 0.133 },
        { y: 0.91, x: 0.1, z: 0.125 },
      ]),
      denim,
      [side * 0.12, 0, 0],
      [0, 0, -side * 0.014],
    );
    const seam = new T.Color(denim).multiplyScalar(1.22).getStyle();
    body.tube(
      [
        [side * 0.218, 0.17, 0.017],
        [side * 0.218, 0.42, 0.034],
        [side * 0.22, 0.65, 0.024],
        [side * 0.219, 0.84, 0],
      ],
      0.0025,
      seam,
    );
    for (let i = 0; i < 3; i++)
      body.tube(
        [
          [side * 0.17, 0.42 + i * 0.032, 0.112],
          [side * 0.12, 0.43 + i * 0.029, 0.139],
          [side * 0.073, 0.428 + i * 0.025, 0.12],
        ],
        0.002,
        denim,
      );
    body.box(
      [0.19, 0.038, 0.25],
      "#37465e",
      [side * 0.134, 0.115, 0.013],
      0.008,
    );
    body.box([0.205, 0.118, 0.345], white, [side * 0.135, 0.064, 0.076], 0.047);
    body.box(
      [0.21, 0.028, 0.35],
      "#d4cdbf",
      [side * 0.135, 0.02, 0.076],
      0.006,
    );
    body.box([0.15, 0.03, 0.11], cloth, [side * 0.135, 0.128, -0.014], 0.014);
    for (let i = 0; i < 3; i++)
      body.box(
        [0.095, 0.012, 0.015],
        "#d7d9dc",
        [side * 0.135, 0.128, 0.075 + i * 0.037],
        0.004,
      );
    body.box(
      [0.115, 0.115, 0.012],
      "#52617b",
      [side * 0.13, 0.88, 0.151],
      0.012,
      [0, 0, side * 0.08],
    );
  }
  const style = companion.outfit === "star-shirt" ? "tee" : a.clothing_style;
  const torso = body.mesh(
    new T.LatheGeometry(
      [
        new T.Vector2(0.208, 0),
        new T.Vector2(0.237, 0.07),
        new T.Vector2(0.24, 0.32),
        new T.Vector2(shoulder, 0.49),
        new T.Vector2(0.21, 0.57),
        new T.Vector2(0.11, 0.585),
      ],
      24,
    ),
    style === "jacket" || style === "overshirt" ? white : cloth,
    [0, 0.94, 0],
  );
  torso.scale.z = 0.64;
  // Ribbed hem, cuff stitches and a garment label survive close camera views.
  body.torus(0.218, 0.011, cloth, [0, 0.995, 0], [Math.PI / 2, 0, 0]).scale.y =
    0.66;
  body.box([0.031, 0.043, 0.005], white, [0.173, 1.017, 0.123], 0.002);
  for (let i = 0; i < 8; i++)
    body.tube(
      [
        [-0.15 + i * 0.043, 1.012, 0.132],
        [-0.15 + i * 0.043, 1.037, 0.139],
      ],
      0.0016,
      new T.Color(cloth).multiplyScalar(0.75).getStyle(),
    );
  body.finish = "skin";
  body.cylinder(0.077, 0.092, 0.115, skin, [0, 1.57, 0]);
  body.finish = "fabric";
  body.torus(
    0.096,
    0.014,
    style === "hoodie" ? cloth : dark,
    [0, 1.53, 0],
    [Math.PI / 2, 0, 0],
  );
  if (style === "hoodie") {
    body.ball([0.205, 0.17, 0.115], cloth, [0, 1.49, -0.135]);
    body.box([0.28, 0.11, 0.028], cloth, [0, 1.095, 0.157], 0.035);
    body.tube(
      [
        [-0.13, 1.065, 0.177],
        [-0.13, 1.13, 0.17],
        [0, 1.143, 0.18],
        [0.13, 1.13, 0.17],
        [0.13, 1.065, 0.177],
      ],
      0.0025,
      new T.Color(cloth).multiplyScalar(0.72).getStyle(),
    );
    for (const side of [-1, 1])
      body.tube(
        [
          [side * 0.057, 1.51, 0.075],
          [side * 0.054, 1.41, 0.169],
          [side * 0.072, 1.35, 0.17],
        ],
        0.007,
        white,
      );
  }
  if (style === "jacket" || style === "overshirt") {
    for (const side of [-1, 1]) {
      body.box([0.157, 0.52, 0.06], cloth, [side * 0.157, 1.234, 0.15], 0.022, [
        0,
        0,
        side * -0.018,
      ]);
      body.box(
        [0.045, 0.165, 0.046],
        cloth,
        [side * 0.072, 1.456, 0.16],
        0.01,
        [0, 0, side * 0.36],
      );
    }
    body.box([0.035, 0.5, 0.028], "#d5b572", [0.078, 1.22, 0.19], 0.002);
    for (let i = 0; i < 23; i++)
      body.box(
        [0.012, 0.006, 0.006],
        "#aa9a7d",
        [0.078, 1.0 + i * 0.019, 0.208],
        0.001,
      );
    body.box([0.018, 0.036, 0.008], "#c3b18d", [0.078, 1.433, 0.215], 0.003);
    if (style === "jacket")
      body.box([0.055, 0.06, 0.01], white, [-0.177, 1.35, 0.188], 0.003);
  }
  if (companion.outfit === "star-shirt") {
    const star = new T.Shape();
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 + Math.PI / 2,
        r = i % 2 ? 0.029 : 0.069;
      const x = Math.cos(angle) * r,
        y = Math.sin(angle) * r;
      if (!i) star.moveTo(x, y);
      else star.lineTo(x, y);
    }
    star.closePath();
    body.mesh(
      new T.ExtrudeGeometry(star, { depth: 0.005, bevelEnabled: false }),
      "#e4bb66",
      [0, 1.3, 0.171],
    );
  }
  if (companion.outfit === "overalls") {
    body.box([0.31, 0.35, 0.045], "#7296a6", [0, 1.12, 0.18], 0.028);
    for (const side of [-1, 1]) {
      body.box(
        [0.049, 0.38, 0.025],
        "#7296a6",
        [side * 0.125, 1.37, 0.173],
        0.008,
      );
      body.ball([0.017, 0.017, 0.012], "#ddb76d", [side * 0.125, 1.253, 0.21]);
    }
    body.box([0.15, 0.1, 0.025], "#608899", [0, 1.13, 0.213], 0.013);
  }
  for (const side of [-1, 1]) {
    const arm = new Model();
    arm.finish = "fabric";
    arm.group.name = side < 0 ? "left-arm" : "right-arm";
    const start: V3 = [side * shoulder, 1.44, 0],
      elbow: V3 = [side * (shoulder + 0.065), 1.17, 0.018],
      wrist: V3 = [side * (shoulder + 0.04), 0.974, 0.084];
    const sleeveColor = style === "jacket" ? white : cloth;
    arm.rod(start, elbow, 0.085, sleeveColor);
    arm.ball([0.087, 0.091, 0.091], sleeveColor, start);
    arm.rod(elbow, wrist, 0.066, style === "tee" ? skin : sleeveColor);
    arm.finish = "skin";
    arm.ball(
      [0.066, 0.072, 0.068],
      style === "tee" ? skin : sleeveColor,
      elbow,
    );
    arm.ball(
      [0.061, 0.077, 0.05],
      skin,
      [wrist[0], wrist[1] - 0.055, wrist[2] + 0.006],
      [0, 0, side * 0.1],
    );
    arm.ball([0.025, 0.046, 0.026], skin, [
      wrist[0] - side * 0.049,
      wrist[1] - 0.035,
      wrist[2] + 0.037,
    ]);
    for (let finger = 0; finger < 3; finger++)
      arm.tube(
        [
          [
            wrist[0] - 0.026 + finger * 0.019,
            wrist[1] - 0.065,
            wrist[2] + 0.053,
          ],
          [
            wrist[0] - 0.025 + finger * 0.019,
            wrist[1] - 0.102,
            wrist[2] + 0.04,
          ],
        ],
        0.0015,
        new T.Color(skin).multiplyScalar(0.78).getStyle(),
      );
    body.add(compact(arm.group));
  }
  // Rounded jaw and a gently tapered chin; small eyes avoid a baby/toy-face proportion.
  head.mesh(
    loft(
      [
        { y: -0.246, x: 0.008, z: 0.016, offset: 0.035 },
        { y: -0.229, x: 0.067, z: 0.067, offset: 0.023 },
        { y: -0.196, x: 0.116, z: 0.11, offset: 0.013 },
        { y: -0.152, x: 0.151, z: 0.14, offset: 0.004 },
        { y: -0.104, x: 0.177, z: 0.164 },
        { y: -0.044, x: 0.198, z: 0.18, offset: -0.004 },
        { y: 0.014, x: 0.206, z: 0.184, offset: -0.008 },
        { y: 0.072, x: 0.207, z: 0.186, offset: -0.01 },
        { y: 0.128, x: 0.194, z: 0.181, offset: -0.012 },
        { y: 0.178, x: 0.169, z: 0.157, offset: -0.016 },
        { y: 0.219, x: 0.12, z: 0.112, offset: -0.019 },
        { y: 0.247, x: 0.055, z: 0.05, offset: -0.023 },
        { y: 0.255, x: 0.001, z: 0.001, offset: -0.024 },
      ],
      56,
    ),
    skin,
  );
  for (const side of [-1, 1]) {
    head.ball([0.041, 0.063, 0.035], skin, [side * 0.21, -0.012, 0]);
    head.ball(
      [0.017, 0.036, 0.012],
      new T.Color(skin).multiplyScalar(0.8).getStyle(),
      [side * 0.227, -0.012, 0.025],
    );
    const eyeY = 0.016 + (companion.eyes % 3) * 0.003;
    head.ball(
      [0.038, 0.029, 0.011],
      white,
      [side * 0.085, eyeY, 0.176],
      [0, side * 0.16, 0],
    );
    head.finish = "ceramic";
    head.ball([0.019, 0.021, 0.01], "#74634c", [side * 0.083, eyeY, 0.186]);
    head.ball([0.01, 0.014, 0.008], dark, [side * 0.083, eyeY, 0.193]);
    head.ball([0.006, 0.007, 0.004], white, [
      side * 0.081 - 0.005,
      eyeY + 0.007,
      0.198,
    ]);
    head.tube(
      [
        [side * 0.13, 0.073, 0.163],
        [side * 0.086, 0.083, 0.181],
        [side * 0.044, 0.078, 0.176],
      ],
      0.009,
      hair,
    );
    head.finish = "skin";
    head.tube(
      [
        [side * 0.126, eyeY + 0.009, 0.17],
        [side * 0.088, eyeY + 0.029, 0.18],
        [side * 0.049, eyeY + 0.008, 0.171],
      ],
      0.0035,
      new T.Color(skin).multiplyScalar(0.72).getStyle(),
    );
  }
  head.ball([0.025, 0.036, 0.032], skin, [0, -0.024, 0.193]);
  head.ball([0.016, 0.048, 0.013], skin, [0, 0.009, 0.179]);
  for (const side of [-1, 1])
    head.ball(
      [0.009, 0.004, 0.005],
      new T.Color(skin).multiplyScalar(0.6).getStyle(),
      [side * 0.014, -0.046, 0.208],
    );
  const smile = companion.mouth % 3 === 1 ? 0.012 : 0.02;
  head.tube(
    [
      [-0.047, -0.088, 0.168],
      [0, -0.088 - smile, 0.182],
      [0.047, -0.088, 0.168],
    ],
    0.0045,
    new T.Color(skin).lerp(new T.Color("#884d49"), 0.46).getStyle(),
  );
  if (companion.eyes === 4)
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        head.ball([0.003, 0.003, 0.002], "#a46e50", [
          side * (0.052 + i * 0.018),
          -0.035 + (i % 2) * 0.009,
          0.178,
        ]);
  const cap = hairModel.mesh(
    new T.SphereGeometry(0.222, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.54),
    hair,
    [0, 0.035, -0.012],
  );
  cap.scale.set(1.025, 1, 1.035);
  // Directional locks across the crown, each tapered and individually shaded.
  for (let i = 0; i < 34; i++) {
    const phi = (i / 34) * Math.PI * 2;
    const points: V3[] = [];
    for (let j = 0; j < 9; j++) {
      const theta = 0.12 + j * 0.153,
        angle = phi + (1 - j / 8) * 0.23;
      points.push([
        Math.sin(theta) * Math.sin(angle) * 0.231,
        0.042 + Math.cos(theta) * 0.231,
        Math.sin(theta) * Math.cos(angle) * 0.232 - 0.012,
      ]);
    }
    hairModel.tube(
      points,
      0.0023,
      new T.Color(hair).multiplyScalar(i % 3 === 0 ? 1.22 : 0.83).getStyle(),
    );
  }
  if (a.hair_style === "short") {
    for (let i = 0; i < 8; i++)
      hairLock(
        hairModel,
        [
          [-0.16 + i * 0.045, 0.15, -0.03],
          [-0.15 + i * 0.043, 0.24, 0.06],
          [-0.14 + i * 0.043, 0.21, 0.16],
          [-0.1 + i * 0.04, 0.1 + Math.abs(i - 3) * 0.009, 0.18],
        ],
        0.045,
        new T.Color(hair).multiplyScalar(1 + (i % 3) * 0.035).getStyle(),
      );
    for (const side of [-1, 1])
      hairModel.box(
        [0.035, 0.107, 0.107],
        hair,
        [side * 0.207, 0.002, -0.014],
        0.02,
      );
  }
  if (a.hair_style === "curls" || a.hair_style === "afro") {
    const radius = a.hair_style === "afro" ? 0.28 : 0.225,
      curl = a.hair_style === "afro" ? 0.068 : 0.052;
    for (let i = 0; i < 48; i++) {
      const y = 0.02 + (i / 48) * 0.95,
        angle = i * 2.39996,
        r = Math.sqrt(1 - y * y) * radius;
      hairModel.ball([curl, curl * 0.94, curl], hair, [
        Math.cos(angle) * r,
        0.035 + y * radius,
        Math.sin(angle) * r - 0.015,
      ]);
      const cx = Math.cos(angle) * r,
        cy = 0.035 + y * radius,
        cz = Math.sin(angle) * r - 0.015;
      const strand: V3[] = [];
      for (let j = 0; j < 13; j++) {
        const t = (j / 12) * Math.PI * 2.5;
        strand.push([
          cx + Math.cos(t) * curl * 0.81,
          cy + Math.sin(t) * curl * 0.76,
          cz + curl * 0.61 + j * 0.0007,
        ]);
      }
      hairModel.tube(
        strand,
        0.003,
        new T.Color(hair).multiplyScalar(1.17).getStyle(),
      );
    }
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        hairModel.ball([curl * 0.8, curl, curl], hair, [
          side * 0.208,
          0.1 - i * 0.045,
          -0.075,
        ]);
  }
  if (["bob", "long", "braids"].includes(a.hair_style)) {
    for (let i = 0; i < 15; i++) {
      const angle = 0.88 + (i * (Math.PI * 2 - 1.76)) / 14,
        x = Math.sin(angle) * 0.204,
        z = Math.cos(angle) * 0.198;
      const long = a.hair_style === "long";
      hairLock(
        hairModel,
        [
          [x * 0.76, 0.16, z * 0.83],
          [x, 0.015, z],
          [x * 1.09, long ? -0.2 : -0.13, z - 0.005],
          [x * 1.02, long ? -0.43 : -0.2, z - 0.022],
        ],
        long ? 0.051 : 0.047,
        new T.Color(hair).multiplyScalar(1 + (i % 4) * 0.025).getStyle(),
      );
    }
    hairModel.ball(
      [0.16, 0.059, 0.043],
      hair,
      [-0.041, 0.15, 0.155],
      [0, 0, 0.35],
    );
    if (a.hair_style === "braids")
      for (const side of [-1, 1]) {
        for (let i = 0; i < 9; i++)
          for (const twist of [-1, 1])
            hairModel.ball([0.038, 0.043, 0.038], hair, [
              side * 0.23 + twist * Math.sin(i * 2) * 0.013,
              -0.095 - i * 0.045,
              0.036 + twist * Math.cos(i * 2) * 0.016,
            ]);
        hairModel.torus(
          0.038,
          0.011,
          cloth,
          [side * 0.23, -0.46, 0.036],
          [Math.PI / 2, 0, 0],
        );
      }
  }
  head.add(compact(hairModel.group));
  if (companion.accessory === "glasses")
    head.add(equipmentModel("glasses"), [0, 0.017, 0.211]);
  if (companion.accessory === "headphones")
    head.add(equipmentModel("headphones", cloth), [0, 0.043, -0.012]);
  if (companion.accessory === "bow")
    head.add(equipmentModel("bow"), [0.145, 0.171, 0.142], [0, 0, -0.3], 0.58);
  if (companion.accessory === "cap")
    head.add(
      equipmentModel("cap", cloth),
      [0, 0.145, 0],
      [0, -0.13, -0.035],
      0.96,
    );
  if (companion.accessory === "scarf")
    body.add(equipmentModel("scarf"), [0, 1.543, 0]);
  if (companion.accessory === "backpack")
    body.add(equipmentModel("backpack", cloth), [0, 1.22, -0.238]);
  root.add(compact(body.group));
  compact(head.group);
  head.group.position.y = 1.782;
  root.add(head.group);
  return root;
}
