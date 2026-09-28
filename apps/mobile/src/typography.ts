import type { TextStyle } from "react-native";

// SDK 57 needs static font faces on native. A variable TTF rendered as Thin.
export function outfitFace(weight: TextStyle["fontWeight"] = "400") {
  const numeric =
    weight === "bold" ? 700 : weight === "normal" ? 400 : Number(weight);
  if (numeric >= 800) return "OutfitExtraBold";
  if (numeric >= 700) return "OutfitBold";
  if (numeric >= 600) return "OutfitSemiBold";
  if (numeric >= 500) return "OutfitMedium";
  return "OutfitRegular";
}
