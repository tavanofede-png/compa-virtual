import {
  Pressable,
  Text as NativeText,
  type TextProps,
  TextInput,
  View,
  StyleSheet,
  type TextInputProps,
} from "react-native";
import type { ReactNode } from "react";
import { designTokens } from "@compa/domain";
export function Text(props: TextProps) {
  return (
    <NativeText
      {...props}
      style={[{ fontFamily: "Outfit", color: designTokens.ink }, props.style]}
    />
  );
}
export const colors = {
  bg: "#f8f4f0",
  ink: "#101e32",
  muted: "#677186",
  green: "#345cce",
  line: "#e8e1db",
  panel: "#f0e8dd",
};
export function Button({
  children,
  onPress,
  secondary = false,
  disabled = false,
}: {
  children: ReactNode;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && { opacity: 0.45 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: colors.green }]}>
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7, marginVertical: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#a1a98f"
        {...props}
        style={[
          styles.input,
          { fontFamily: "Outfit" },
          props.multiline && { minHeight: 90, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Choices({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 8, marginVertical: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
        {options.map((o) => (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: o.value === value }}
            onPress={() => onChange(o.value)}
            style={[
              styles.choice,
              o.value === value && { backgroundColor: colors.green },
            ]}
          >
            <Text
              style={{
                color: o.value === value ? "#fffefa" : colors.green,
                fontSize: 16,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}
export const styles = StyleSheet.create({
  button: {
    backgroundColor: designTokens.yellow,
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginVertical: 5,
  },
  secondary: {
    backgroundColor: "#fffefa",
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonText: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  label: { fontSize: 14, color: colors.muted },
  input: {
    backgroundColor: "#fffefa",
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 13,
    fontSize: 16,
    minHeight: 50,
  },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    borderRadius: 14,
    minHeight: 48,
  },
  card: {
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    backgroundColor: "#fffefa",
    marginVertical: 10,
    gap: 10,
  },
  h1: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: -1,
    color: colors.ink,
    lineHeight: 38,
  },
  h2: { fontSize: 20, fontWeight: "600", color: colors.ink },
  h3: { fontSize: 16, fontWeight: "600", color: colors.ink },
  p: { fontSize: 16, color: colors.muted, lineHeight: 25 },
  eyebrow: {
    fontSize: 16,
    letterSpacing: 1.8,
    color: colors.muted,
    marginBottom: 9,
  },
  row: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: colors.line,
    gap: 7,
  },
  tag: {
    fontSize: 16,
    color: colors.green,
    backgroundColor: colors.panel,
    padding: 7,
    alignSelf: "flex-start",
    borderRadius: 4,
  },
  error: {
    color: "#a04c32",
    backgroundColor: "#f6e9df",
    padding: 14,
    borderRadius: 14,
    lineHeight: 20,
  },
  link: { color: colors.green, paddingVertical: 12, fontWeight: "600" },
  section: { marginTop: 25, marginBottom: 10 },
});
