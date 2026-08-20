import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createSessionStore } from "./sessionStore";

export const staffSessionStore = createSessionStore(SecureStore, AsyncStorage, {
  secureKey: "gagan.staff.session.v1",
  legacyKeys: ["gagan_rep_token"],
});
