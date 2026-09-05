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
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
