import { useFonts } from "expo-font";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
if (!globalThis.crypto)
  Object.assign(globalThis, {
    crypto: {
      randomUUID: Crypto.randomUUID,
      getRandomValues: Crypto.getRandomValues,
    },
  });
else if (!globalThis.crypto.randomUUID)
  Object.assign(globalThis.crypto, { randomUUID: Crypto.randomUUID });
export default function Layout() {
  const [fontsReady, fontError] = useFonts({
    OutfitRegular: require("../assets/fonts/Outfit-Regular.ttf"),
    OutfitMedium: require("../assets/fonts/Outfit-Medium.ttf"),
    OutfitSemiBold: require("../assets/fonts/Outfit-SemiBold.ttf"),
    OutfitBold: require("../assets/fonts/Outfit-Bold.ttf"),
    OutfitExtraBold: require("../assets/fonts/Outfit-ExtraBold.ttf"),
  });
  if (!fontsReady && !fontError)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: "#f8f4f0",
        }}
      >
        <ActivityIndicator color="#345cce" />
      </View>
    );
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
