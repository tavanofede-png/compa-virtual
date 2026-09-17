import type { SharedSpaceId } from "./collaboration";
import {
  sharedRoomAssetRevision,
  sharedRoomLayouts,
} from "./shared-room-layouts";
export interface SharedSeat {
  id: string;
  position: [number, number, number];
  yaw: number;
  height: number;
}
export function sharedSeats(id: SharedSpaceId): SharedSeat[] {
  return sharedRoomLayouts[id].map((seat) => ({
    ...seat,
    position: [...seat.position],
  }));
}
export const sharedSpaceRevision = sharedRoomAssetRevision;
export const sharedSpacePreview = (id: SharedSpaceId) =>
  `/selection/shared-spaces/${id}.webp?v=${sharedSpaceRevision}`;
