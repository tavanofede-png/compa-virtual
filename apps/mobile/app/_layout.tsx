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
    Outfit: require("../../web/public/fonts/Outfit.ttf"),
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
