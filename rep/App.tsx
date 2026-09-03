import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RepProvider, useRep } from "./src/context/RepContext";
import { LanguageProvider, useLanguage } from "./src/i18n/LanguageContext";
import { colors } from "./src/theme";
import { ocean } from "./src/screens/retailerForm/ocean";
import { OceanTabBar } from "./src/components/OceanTabBar";
import { staffCapabilities } from "./src/auth/staffCapabilities";

import RepLoginScreen from "./src/screens/RepLoginScreen";
import LanguageSelectionScreen from "./src/screens/LanguageSelectionScreen";
import OceanHomeScreen from "./src/screens/OceanHomeScreen";
import OrderHubScreen from "./src/screens/OrderHubScreen";
import StockHubScreen from "./src/screens/StockHubScreen";
import MoreScreen from "./src/screens/MoreScreen";
import RepRetailersScreen from "./src/screens/RepRetailersScreen";
import RepRetailerDetailScreen from "./src/screens/RepRetailerDetailScreen";
import RepCatalogScreen from "./src/screens/RepCatalogScreen";
import RepAccountScreen from "./src/screens/RepAccountScreen";
import StaffHomeScreen from "./src/screens/StaffHomeScreen";
import ApprovalsScreen from "./src/screens/ApprovalsScreen";
import ApprovalDetailScreen from "./src/screens/ApprovalDetailScreen";
import RatingReviewsScreen from "./src/screens/RatingReviewsScreen";
import KycCaptureScreen from "./src/screens/KycCaptureScreen";
import AddRetailerScreen from "./src/screens/AddRetailerScreen";
import EditRetailerScreen from "./src/screens/EditRetailerScreen";
import RoutePlanScreen from "./src/screens/RoutePlanScreen";
import EndDayScreen from "./src/screens/EndDayScreen";
import FieldHubScreen from "./src/screens/FieldHubScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    primary: colors.sky,
    text: colors.ink,
    border: colors.border,
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.navy,
  headerTitleStyle: { color: colors.ink, fontWeight: "700" as const },
  contentStyle: { backgroundColor: colors.bg },
};

const oceanFormOptions = {
  headerStyle: { backgroundColor: ocean.navy },
  headerTintColor: ocean.sky,
  headerTitleStyle: { color: ocean.ink, fontWeight: "700" as const },
  contentStyle: { backgroundColor: ocean.navy },
};

function RepTabs() {
  const { t } = useLanguage();
  return (
    <Tab.Navigator
      tabBar={(props) => <OceanTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Attendance" component={OceanHomeScreen} options={{ tabBarLabel: t("tabs.attendance") }} />
      <Tab.Screen name="Order" component={OrderHubScreen} options={{ tabBarLabel: t("tabs.order") }} />
      <Tab.Screen name="Stock" component={StockHubScreen} options={{ tabBarLabel: t("tabs.stock") }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ tabBarLabel: t("tabs.more") }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { staff, loading } = useRep();
  const { selectionRequired, t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.sky} />
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
          <Stack.Screen name="RepMain" component={RepTabs} options={{ headerShown: false, title: t("tabs.attendance") }} />
          <Stack.Screen name="Retailers" component={RepRetailersScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Account" component={RepAccountScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Collections" component={StaffHomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Approvals" component={ApprovalsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="RoutePlan" component={RoutePlanScreen} options={{ title: t("more.route") }} />
          <Stack.Screen name="EndDay" component={EndDayScreen} options={{ title: t("more.endDay") }} />
          <Stack.Screen name="Leave" component={FieldHubScreen} initialParams={{ kind: "leave" }} options={{ title: t("more.leave") }} />
          <Stack.Screen name="Expenses" component={FieldHubScreen} initialParams={{ kind: "expenses" }} options={{ title: t("more.expenses") }} />
          <Stack.Screen name="SalesKit" component={FieldHubScreen} initialParams={{ kind: "salesKit" }} options={{ title: t("more.salesKit") }} />
          <Stack.Screen
            name="RepRetailerDetail"
            component={RepRetailerDetailScreen}
            options={{ title: t("retailer.title"), headerBackTitle: t("common.back") }}
          />
          <Stack.Screen
            name="RepCatalog"
            component={RepCatalogScreen}
            options={{ title: t("orders.new"), headerBackTitle: t("common.back") }}
          />
          <Stack.Screen name="KycCapture" component={KycCaptureScreen} options={{ title: t("kyc.title"), headerBackTitle: t("retailer.title") }} />
          <Stack.Screen
            name="AddRetailer"
            component={AddRetailerScreen}
            options={{ title: t("retailerForm.addTitle"), headerBackTitle: t("common.back"), ...oceanFormOptions }}
          />
          <Stack.Screen
            name="EditRetailer"
            component={EditRetailerScreen}
            options={{ title: t("retailerForm.editTitle"), headerBackTitle: t("retailer.title"), ...oceanFormOptions }}
          />
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
