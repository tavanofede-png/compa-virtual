import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { Repository } from "@compa/client";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
export async function registerPush(repo: Repository, requestPermission = true) {
  if (!Device.isDevice || Platform.OS === "web")
    throw Error(
      "Las notificaciones se prueban en un teléfono físico con una compilación de desarrollo.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("study-reminders", {
      name: "Recordatorios de estudio",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  const permissions = await Notifications.getPermissionsAsync();
  const status =
    permissions.status === "granted"
      ? permissions.status
      : requestPermission
        ? (await Notifications.requestPermissionsAsync()).status
        : permissions.status;
  if (status !== "granted") return { enabled: false };
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    if (!requestPermission) return { enabled: false };
    throw Error("Falta vincular esta app con el proyecto EAS.");
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await repo.registerDevice(token, Platform.OS);
  return { enabled: true };
}
