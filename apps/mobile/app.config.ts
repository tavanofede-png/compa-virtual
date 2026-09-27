import type { ConfigContext, ExpoConfig } from "expo/config";

// Keep project identity in app.json so EAS can persist its project ID.
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  return {
    ...config,
    name: config.name ?? "Kusiy",
    slug: config.slug ?? "kusiy",
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
