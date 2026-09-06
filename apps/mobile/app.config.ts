import type { ConfigContext, ExpoConfig } from "expo/config";

// Keep project identity in app.json so EAS can persist its project ID.
export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
  return {
    ...config,
    name: config.name ?? "Compa Virtual",
    slug: config.slug ?? "compa-virtual",
    ios: {
      ...config.ios,
      bundleIdentifier:
        process.env.IOS_BUNDLE_IDENTIFIER || config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: process.env.ANDROID_PACKAGE || config.android?.package,
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}),
    },
  };
};
