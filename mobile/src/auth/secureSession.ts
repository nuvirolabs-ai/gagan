import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createSessionStore } from "./sessionStore";

export const retailerSessionStore = createSessionStore(SecureStore, AsyncStorage, {
  secureKey: "gagan.retailer.session.v1",
  legacyKeys: ["gagan_token"],
});
