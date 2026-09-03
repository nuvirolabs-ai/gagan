import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { PreferencesProvider, usePreferences } from "./src/context/PreferencesContext";
import TabBar from "./src/components/TabBar";
import LoginScreen from "./src/screens/LoginScreen";
import PulseScreen from "./src/screens/PulseScreen";
import TrendsScreen from "./src/screens/TrendsScreen";
import IssuesScreen from "./src/screens/IssuesScreen";
import DecisionsScreen from "./src/screens/DecisionsScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import IssueDetailScreen from "./src/screens/IssueDetailScreen";
import DecisionDetailScreen from "./src/screens/DecisionDetailScreen";
import BriefScreen from "./src/screens/BriefScreen";
import TeamScreen from "./src/screens/TeamScreen";
import QueueScreen from "./src/screens/QueueScreen";
import { PULSE_VISUAL_FIXTURE } from "./src/fixtures/pulseVisual";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function PreviewPulse() {
  return <PulseScreen preview={PULSE_VISUAL_FIXTURE} />;
}

function AppTabs({ preview }: { preview?: boolean }) {
  return (
    <Tab.Navigator tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Today" component={preview ? PreviewPulse : PulseScreen} />
      <Tab.Screen name="Series" component={TrendsScreen} />
      <Tab.Screen name="Queue" component={QueueScreen} />
      <Tab.Screen name="You" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function AppStack({ preview }: { preview?: boolean }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="Main">{() => <AppTabs preview={preview} />}</Stack.Screen>
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: "modal", animation: "slide_from_bottom" }} />
      <Stack.Screen name="Issues" component={IssuesScreen} />
      <Stack.Screen name="Decisions" component={DecisionsScreen} />
      <Stack.Screen name="IssueDetail" component={IssueDetailScreen} />
      <Stack.Screen name="DecisionDetail" component={DecisionDetailScreen} />
      <Stack.Screen name="Brief" component={BriefScreen} />
      <Stack.Screen name="Team" component={TeamScreen} />
    </Stack.Navigator>
  );
}

function Root() {
  const { ready, identity } = useAuth();
  const { colors } = usePreferences();
  if (!ready && process.env.EXPO_PUBLIC_PULSE_PREVIEW !== "1") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (process.env.EXPO_PUBLIC_PULSE_PREVIEW === "1") return <AppStack preview />;
  if (!identity) return <LoginScreen />;
  return <AppStack />;
}

function ThemedApp() {
  const { colors } = usePreferences();
  const theme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: colors.canvas,
      card: colors.surface,
      text: colors.label,
      border: colors.separator,
      primary: colors.positive,
    },
  };
  return (
    <NavigationContainer theme={theme}>
      <Root />
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AuthProvider>
          <ThemedApp />
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
