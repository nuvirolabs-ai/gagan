import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { RepProvider, useRep } from "./src/context/RepContext";
import { LanguageProvider, useLanguage } from "./src/i18n/LanguageContext";
import { colors } from "./src/theme";

import RepLoginScreen from "./src/screens/RepLoginScreen";
import RepRetailersScreen from "./src/screens/RepRetailersScreen";
import RepRetailerDetailScreen from "./src/screens/RepRetailerDetailScreen";
import RepCatalogScreen from "./src/screens/RepCatalogScreen";
import RepAccountScreen from "./src/screens/RepAccountScreen";
import StaffHomeScreen from "./src/screens/StaffHomeScreen";
import ApprovalsScreen from "./src/screens/ApprovalsScreen";
import ApprovalDetailScreen from "./src/screens/ApprovalDetailScreen";
import RatingReviewsScreen from "./src/screens/RatingReviewsScreen";
import KycCaptureScreen from "./src/screens/KycCaptureScreen";
import { staffCapabilities } from "./src/auth/staffCapabilities";
import LanguageSelectionScreen from "./src/screens/LanguageSelectionScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    primary: colors.green,
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.green,
  headerTitleStyle: { color: colors.ink, fontWeight: "700" as const },
  contentStyle: { backgroundColor: colors.bg },
};

function RepTabs() {
  const { staff } = useRep();
  const { t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Both tab screens render their own <ScreenHeader>.
        headerShown: false,
        tabBarLabel: t(`tabs.${route.name.toLowerCase()}`),
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={route.name === "Retailers" ? "storefront-outline" : route.name === "Work" ? "briefcase-outline" : route.name === "Approvals" ? "shield-checkmark-outline" : "person-outline"}
            size={size}
            color={color}
          />
        ),
      })}
    >
      {capabilities.canOrderForRetailers ? (
        <Tab.Screen name="Retailers" component={RepRetailersScreen} />
      ) : (
        <Tab.Screen name="Work" component={StaffHomeScreen} />
      )}
      {capabilities.canApprove && <Tab.Screen name="Approvals" component={ApprovalsScreen} />}
      <Tab.Screen name="Account" component={RepAccountScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { staff, loading } = useRep();
  const { selectionRequired, t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);

  if (loading) {
    return (
      <View
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}
      >
        <ActivityIndicator size="large" color={colors.green} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      {!staff ? (
        <Stack.Screen name="Login" component={RepLoginScreen} options={{ headerShown: false }} />
      ) : selectionRequired ? (
        <Stack.Screen name="Language" component={LanguageSelectionScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen
            name="RepMain"
            component={RepTabs}
            options={{ headerShown: false, title: t("tabs.retailers") }}
          />
          {capabilities.canOrderForRetailers && (
            <>
              <Stack.Screen
                name="RepRetailerDetail"
                component={RepRetailerDetailScreen}
                options={{ title: t("retailer.title"), headerBackTitle: t("tabs.retailers") }}
              />
              <Stack.Screen
                name="RepCatalog"
                component={RepCatalogScreen}
                options={{ title: t("orders.new"), headerBackTitle: t("common.back") }}
              />
              <Stack.Screen name="KycCapture" component={KycCaptureScreen} options={{ title: t("kyc.title"), headerBackTitle: t("retailer.title") }} />
            </>
          )}
          {capabilities.canApprove && (
            <Stack.Screen
              name="ApprovalDetail"
              component={ApprovalDetailScreen}
              options={{ title: t("approval.title"), headerBackTitle: t("tabs.approvals") }}
            />
          )}
          {capabilities.canReviewRatings && (
            <Stack.Screen name="RatingReviews" component={RatingReviewsScreen} options={{ title: t("rating.title"), headerBackTitle: t("tabs.approvals") }} />
          )}
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <RepProvider>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </RepProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
