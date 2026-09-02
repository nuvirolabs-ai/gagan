import React from "react";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import TabBar from "./src/components/TabBar";
import LoginScreen from "./src/screens/LoginScreen";
import PulseScreen from "./src/screens/PulseScreen";
import PlaceholderScreen from "./src/screens/PlaceholderScreen";
import { tokensFor } from "./src/theme";

import { PULSE_VISUAL_FIXTURE } from "./src/fixtures/pulseVisual";

const Tab = createBottomTabNavigator();

function PreviewPulse() {
  return <PulseScreen preview={PULSE_VISUAL_FIXTURE} />;
}

function Trends() {
  return (
    <PlaceholderScreen
      title="Trends"
      body="Trends will open after Pulse is approved."
    />
  );
}

function Issues() {
  return (
    <PlaceholderScreen
      title="Issues"
      body="Issue detail will open after Pulse is approved."
    />
  );
}

function Decisions() {
  return (
    <PlaceholderScreen
      title="Decisions"
      body="No decisions waiting. Operations are within delegated authority."
    />
  );
}

function Root() {
  const { ready, identity } = useAuth();
  const colors = tokensFor(useColorScheme());
  if (!ready && process.env.EXPO_PUBLIC_PULSE_PREVIEW !== "1") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (process.env.EXPO_PUBLIC_PULSE_PREVIEW === "1") {
    return (
      <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Pulse" component={PreviewPulse} />
        <Tab.Screen name="Trends" component={Trends} />
        <Tab.Screen name="Issues" component={Issues} />
        <Tab.Screen name="Decisions" component={Decisions} />
      </Tab.Navigator>
    );
  }
  if (!identity) return <LoginScreen />;
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Pulse" component={PulseScreen} />
      <Tab.Screen name="Trends" component={Trends} />
      <Tab.Screen name="Issues" component={Issues} />
      <Tab.Screen name="Decisions" component={Decisions} />
    </Tab.Navigator>
  );
}

export default function App() {
  const dark = useColorScheme() === "dark";
  const colors = tokensFor(dark ? "dark" : "light");
  const theme = {
    ...(dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(dark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.canvas,
      card: colors.surface,
      text: colors.label,
      border: colors.separator,
      primary: colors.label,
    },
  };
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={theme}>
          <Root />
          <StatusBar style={dark ? "light" : "dark"} />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
