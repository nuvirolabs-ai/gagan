import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createSessionStore } from "./sessionStore";

// SecureStore is the right native boundary, but its native module is not
// available in the Expo web runtime. The existing AsyncStorage dependency is
// the deliberate web preview fallback; standalone mobile builds continue to
// keep tokens in SecureStore.
const webSessionStorage = {
  getItemAsync: (key: string) => AsyncStorage.getItem(key),
  setItemAsync: (key: string, value: string) => AsyncStorage.setItem(key, value),
  deleteItemAsync: (key: string) => AsyncStorage.removeItem(key),
};

const sessionStorage = Platform.OS === "web" ? webSessionStorage : SecureStore;

export const staffSessionStore = createSessionStore(sessionStorage, AsyncStorage, {
  secureKey: "gagan.staff.session.v1",
  legacyKeys: ["gagan_rep_token"],
});
