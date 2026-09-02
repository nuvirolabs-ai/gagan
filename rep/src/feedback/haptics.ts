import { Platform, Vibration } from "react-native";

/**
 * Restrained haptics. Missing native support is a no-op — never block a flow.
 */
export function haptic(kind: "light" | "medium" | "success" | "warning") {
  try {
    if (Platform.OS === "web") return;
    const duration = kind === "light" ? 8 : kind === "warning" ? 40 : kind === "success" ? 24 : 16;
    Vibration.vibrate(duration);
  } catch {
    /* ignore */
  }
}
