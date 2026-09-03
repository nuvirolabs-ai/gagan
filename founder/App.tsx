import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { FounderProvider, useFounder } from "./src/context/FounderContext";
import { colors } from "./src/theme";
import FounderTabBar from "./src/components/FounderTabBar";
import LoginScreen from "./src/screens/LoginScreen";
import TodayScreen from "./src/screens/TodayScreen";
import SeriesScreen from "./src/screens/SeriesScreen";
import QueueScreen from "./src/screens/QueueScreen";
import YouScreen from "./src/screens/YouScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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

function FounderTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <FounderTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Series" component={SeriesScreen} />
      <Tab.Screen name="Queue" component={QueueScreen} />
      <Tab.Screen name="You" component={YouScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { staff, loading } = useFounder();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.up} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {!staff ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <Stack.Screen name="FounderMain" component={FounderTabs} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FounderProvider>
        <NavigationContainer theme={navTheme}>
          <RootNavigator />
          <StatusBar style="light" />
        </NavigationContainer>
      </FounderProvider>
    </SafeAreaProvider>
  );
}
