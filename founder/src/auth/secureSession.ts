import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createSessionStore } from "./sessionStore";

const webStore = {
  getItemAsync: (key: string) => AsyncStorage.getItem(key),
  setItemAsync: (key: string, value: string) => AsyncStorage.setItem(key, value),
  deleteItemAsync: (key: string) => AsyncStorage.removeItem(key),
};

export const founderSessionStore = createSessionStore(
  Platform.OS === "web" ? webStore : SecureStore,
  AsyncStorage,
  {
    secureKey: "gagan.founder.session.v1",
    legacyKeys: ["gagan_founder_token"],
  }
);
