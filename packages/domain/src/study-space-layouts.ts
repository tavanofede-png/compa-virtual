// Generated from validated Blender layouts by scripts/stage-personal-study.mjs.
import type { StudySpaceId } from "./study-spaces";
export interface StudySpaceLayout {
  width: number;
  depth: number;
  seat: [number, number, number];
  yaw: number;
  approach: [number, number];
  assetRevision: string;
}
export const studySpaceLayouts: Record<StudySpaceId, StudySpaceLayout> = {
  "library": {
    "width": 4.4,
    "depth": 3.8,
    "seat": [
      0.645,
      0.51,
      0.9500000000000002
    ],
    "yaw": 3.07208455708297,
    "approach": [
      0.645,
      1.5500000000000003
    ],
    "assetRevision": "c5cdd00d4e63"
  },
  "terrace": {
    "width": 4.5,
    "depth": 3.8,
    "seat": [
      0.685,
      0.51,
      0.8900000000000001
    ],
    "yaw": 3.07208455708297,
    "approach": [
      0.685,
      1.4899999999999998
    ],
    "assetRevision": "cd4c0a2e6511"
  },
  "pergola": {
    "width": 4.6,
    "depth": 4.2,
    "seat": [
      0.4450000000000003,
      0.51,
      1.0499999999999998
    ],
    "yaw": 3.0711963502835573,
    "approach": [
      0.44499999999999984,
      1.65
    ],
    "assetRevision": "7cf2e5f3e918"
  },
  "cafe": {
    "width": 4.2,
    "depth": 3.8,
    "seat": [
      0.29499999999999993,
      0.51,
      0.9450000000000003
    ],
    "yaw": 3.0707436940451833,
    "approach": [
      0.29499999999999993,
      1.545
    ],
    "assetRevision": "592b2a5e6f29"
  },
  "minimal": {
    "width": 4.1,
    "depth": 3.7,
    "seat": [
      -0.5349999999999999,
      0.51,
      -0.04500000000000015
    ],
    "yaw": -1.6435155553481506,
    "approach": [
      0.06499999999999995,
      -0.04499999999999993
    ],
    "assetRevision": "4a10fcc96009"
  },
  "tech": {
    "width": 4.3,
    "depth": 3.9,
    "seat": [
      0.02499999999999991,
      0.51,
      -0.51
    ],
    "yaw": 3.072084557082969,
    "approach": [
      0.02499999999999991,
      0.09000000000000008
    ],
    "assetRevision": "8cdc55940cf7"
  },
  "pavilion": {
    "width": 5,
    "depth": 4.5,
    "seat": [
      0.4950000000000001,
      0.51,
      0.9950000000000001
    ],
    "yaw": 3.0725203214257077,
    "approach": [
      0.4950000000000001,
      1.5949999999999998
    ],
    "assetRevision": "3499ba6fad83"
  },
  "loft": {
    "width": 4.4,
    "depth": 3.9,
    "seat": [
      -0.13500000000000023,
      0.51,
      0.9850000000000001
    ],
    "yaw": 3.068873425036539,
    "approach": [
      -0.1349999999999998,
      1.5850000000000002
    ],
    "assetRevision": "9c1b655ed26b"
  }
};
