import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { PreferencesProvider } from "./src/context/PreferencesContext";
import { FounderProvider } from "./src/context/FounderContext";
import FounderTabBar from "./src/components/FounderTabBar";
import LoginScreen from "./src/screens/LoginScreen";
import TodayScreen from "./src/screens/TodayScreen";
import SeriesScreen from "./src/screens/SeriesScreen";
import QueueScreen from "./src/screens/QueueScreen";
import YouScreen from "./src/screens/YouScreen";
import IssuesScreen from "./src/screens/IssuesScreen";
import DecisionsScreen from "./src/screens/DecisionsScreen";
import IssueDetailScreen from "./src/screens/IssueDetailScreen";
import DecisionDetailScreen from "./src/screens/DecisionDetailScreen";
import BriefScreen from "./src/screens/BriefScreen";
import TeamScreen from "./src/screens/TeamScreen";
import { colors } from "./src/theme";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const PREVIEW = process.env.EXPO_PUBLIC_PULSE_PREVIEW === "1";

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.up,
    text: colors.ink,
    border: colors.line,
  },
};

function AppTabs() {
  return (
    <Tab.Navigator tabBar={(props) => <FounderTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Series" component={SeriesScreen} />
      <Tab.Screen name="Queue" component={QueueScreen} />
      <Tab.Screen name="You" component={YouScreen} />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right", contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="Main" component={AppTabs} />
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
  if (!ready && !PREVIEW) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.up} />
      </View>
    );
  }
  if (PREVIEW) {
    return (
      <FounderProvider enabled>
        <AppStack />
      </FounderProvider>
    );
  }
  if (!identity) return <LoginScreen />;
  return (
    <FounderProvider enabled>
      <AppStack />
    </FounderProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AuthProvider>
          <NavigationContainer theme={navTheme}>
            <Root />
            <StatusBar style="light" />
          </NavigationContainer>
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
