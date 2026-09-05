"use client";
import {
  spriteLayers,
  equipmentSprite,
  atlasInfo,
  type Companion,
  type SpriteLayer,
} from "@compa/domain";
export function Sprite({
  layer,
  scale = 1,
}: {
  layer: SpriteLayer;
  scale?: number;
}) {
  const atlas = atlasInfo[layer.atlas],
    factor = (layer.width / layer.crop.width) * scale;
  return (
    <span
      style={{
        display: "block",
        position: "absolute",
        left: layer.x * scale,
        top: layer.y * scale,
        width: layer.width * scale,
        height: layer.height * scale,
        overflow: "hidden",
        filter: layer.hue ? "hue-rotate(" + layer.hue + "deg)" : undefined,
      }}
    >
      <img
        src={"/art/" + atlas.file}
        alt=""
        style={{
          position: "absolute",
          maxWidth: "none",
          width: atlas.width * factor,
          height: atlas.height * factor,
          left: -layer.crop.x * factor,
          top: -layer.crop.y * factor,
          imageRendering: "pixelated",
        }}
      />
    </span>
  );
}
export function Equipment({ id, width = 55 }: { id: string; width?: number }) {
  const layer = equipmentSprite(id, width);
  return layer ? (
    <span
      style={{
        display: "inline-block",
        width,
        height: layer.height,
        position: "relative",
      }}
    >
      <Sprite layer={layer} />
    </span>
  ) : null;
}
export function Creature({
  companion,
  size = 160,
}: {
  companion: Companion;
  size?: number;
}) {
  return (
    <div
      className="creature"
      style={{ width: size, height: size }}
      aria-label={companion.name}
    >
      {spriteLayers(companion).map((layer, i) => (
        <Sprite key={i} layer={layer} scale={size / 724} />
      ))}
    </div>
  );
}
export function Room({
  companion,
  onTalk,
}: {
  companion: Companion;
  onTalk: () => void;
}) {
  return (
    <div className={"room " + companion.room_theme}>
      <img
        src="/art/study-room.png"
        alt="Habitación en pixel art con escritorio, libros y una ventana al atardecer"
        className="room-art"
      />
      <div className="room-caption">
        <span className="live-dot" /> TU PEQUEÑO GRAN LUGAR
      </div>
      <button
        className="room-companion"
        onClick={onTalk}
        aria-label={`Conversar con ${companion.name}`}
      >
        <Creature companion={companion} size={180} />
        <span className="name-tag">{companion.name} ↗</span>
      </button>
      {companion.decoration !== "none" && (
        <span className="room-decoration">
          <Equipment id={companion.decoration} width={55} />
        </span>
      )}
      <span className="room-hint">Tocá a tu compa para conversar</span>
    </div>
  );
}
