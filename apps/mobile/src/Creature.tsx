import { useId } from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  Filter,
  FeColorMatrix,
  Image,
  ClipPath,
  Rect,
  G,
} from "react-native-svg";
import {
  spriteLayers,
  equipmentSprite,
  atlasInfo,
  type Companion,
  type SpriteLayer,
} from "@compa/domain";
const sources = {
  bases: require("../../../packages/assets/faceless-bases-final.png"),
  face: require("../../../packages/assets/facial-features-atlas.png"),
  equipment: require("../../../packages/assets/equipment-atlas-v2.png"),
};
function Layer({ layer, id }: { layer: SpriteLayer; id: string }) {
  const a = atlasInfo[layer.atlas],
    scale = layer.width / layer.crop.width;
  return (
    <G>
      <Defs>
        <ClipPath id={id}>
          <Rect
            x={layer.x}
            y={layer.y}
            width={layer.width}
            height={layer.height}
          />
        </ClipPath>
        <Filter id={id + "h"}>
          <FeColorMatrix type="hueRotate" values={String(layer.hue ?? 0)} />
        </Filter>
      </Defs>
      <G clipPath={"url(#" + id + ")"}>
        <Image
          href={sources[layer.atlas]}
          x={layer.x - layer.crop.x * scale}
          y={layer.y - layer.crop.y * scale}
          width={a.width * scale}
          height={a.height * scale}
          preserveAspectRatio="none"
          filter={layer.hue ? "url(#" + id + "h)" : undefined}
        />
      </G>
    </G>
  );
}
export function Creature({
  companion,
  size = 160,
}: {
  companion: Companion;
  size?: number;
}) {
  const id = useId().replace(/[^a-z0-9]/gi, "");
  return (
    <View
      accessibilityLabel={companion.name}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox="0 0 724 724">
        {spriteLayers(companion).map((layer, i) => (
          <Layer key={i} layer={layer} id={id + "l" + i} />
        ))}
      </Svg>
    </View>
  );
}
export function Equipment({ id, width = 50 }: { id: string; width?: number }) {
  const uid = useId().replace(/[^a-z0-9]/gi, ""),
    layer = equipmentSprite(id, width);
  if (!layer) return null;
  return (
    <Svg
      width={width}
      height={layer.height}
      viewBox={"0 0 " + width + " " + layer.height}
    >
      <Layer layer={layer} id={uid + "e"} />
    </Svg>
  );
}
