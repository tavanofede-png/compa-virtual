import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
import type { AsyncStorage } from "@compa/client";
const connection = SQLite.openDatabaseAsync("compa-cache.db");
async function database() {
  const db = await connection;
  await db.execAsync(
    "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
  return db;
}
export const cache: AsyncStorage = {
  getItem: async (key) =>
    (
      await (
        await database()
      ).getFirstAsync<{ value: string }>(
        "SELECT value FROM cache WHERE key=?",
        key,
      )
    )?.value ?? null,
  setItem: async (key, value) => {
    await (
      await database()
    ).runAsync(
      "INSERT INTO cache(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      value,
    );
  },
  removeItem: async (key) => {
    await (await database()).runAsync("DELETE FROM cache WHERE key=?", key);
  },
};
export const secureStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") return localStorage.getItem(key);
    const count = Number(await SecureStore.getItemAsync(key + ".count"));
    if (!count) return null;
    let value = "";
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(key + "." + i);
      if (part === null) return null;
      value += part;
    }
    return value;
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      localStorage.setItem(key, value);
      return;
    }
    const count = Math.ceil(value.length / 1500);
    for (let i = 0; i < count; i++)
      await SecureStore.setItemAsync(
        key + "." + i,
        value.slice(i * 1500, (i + 1) * 1500),
        { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
      );
    await SecureStore.setItemAsync(key + ".count", String(count));
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      localStorage.removeItem(key);
      return;
    }
    const count = Number(await SecureStore.getItemAsync(key + ".count"));
    for (let i = 0; i < count; i++)
      await SecureStore.deleteItemAsync(key + "." + i);
    await SecureStore.deleteItemAsync(key + ".count");
  },
};
