import {
  Image,
  StyleSheet,
  View,
  type ImageProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

/** Native Image supplies the asset's intrinsic height, even with aspectRatio.
 * Size the frame first so large bundled previews cannot expand a card. */
export function PreviewImage({
  aspectRatio,
  style,
  resizeMode = "contain",
  ...props
}: Omit<ImageProps, "style"> & {
  aspectRatio: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: "100%", aspectRatio, overflow: "hidden" }, style]}>
      <Image
        {...props}
        resizeMode={resizeMode}
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
      />
    </View>
  );
}
