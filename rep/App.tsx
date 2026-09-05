import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { RepProvider, useRep } from "./src/context/RepContext";
import { FieldProvider } from "./src/context/FieldContext";
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
import TodayScreen from "./src/screens/TodayScreen";
import RouteScreen from "./src/screens/RouteScreen";
import MyDayScreen from "./src/screens/MyDayScreen";
import VisitScreen from "./src/screens/VisitScreen";
import CustomerMapScreen from "./src/screens/CustomerMapScreen";
import MyActivityScreen from "./src/screens/MyActivityScreen";
import ExpensesScreen from "./src/screens/ExpensesScreen";
import IssuesScreen from "./src/screens/IssuesScreen";
import OpportunitiesScreen from "./src/screens/OpportunitiesScreen";
import AddRetailerScreen from "./src/screens/AddRetailerScreen";
import { staffCapabilities } from "./src/auth/staffCapabilities";
import LanguageSelectionScreen from "./src/screens/LanguageSelectionScreen";
import SalesKitScreen from "./src/screens/SalesKitScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    primary: colors.blue,
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerShadowVisible: false,
  headerTintColor: colors.blue,
  headerTitleStyle: { color: colors.ink, fontWeight: "700" as const },
  contentStyle: { backgroundColor: colors.bg },
};

/**
 * Tab icons, keyed by the tab's route name so the shape of the bar can change
 * with permissions without the icon mapping drifting.
 */
const TAB_ICONS: Record<string, string> = {
  Today: "home-outline",
  Retailers: "storefront-outline",
  Work: "briefcase-outline",
  Activity: "bar-chart-outline",
  Approvals: "shield-checkmark-outline",
  More: "ellipsis-horizontal-outline",
};

function RepTabs() {
  const { staff } = useRep();
  const { t } = useLanguage();
  const capabilities = staffCapabilities(staff?.permissions ?? []);
  const tabLabel = (name: string) => ({ Today: "Home", Retailers: "Outlets", Activity: "Reports", Work: "Work", Approvals: "Approvals", More: "More" }[name] ?? t(`tabs.${name.toLowerCase()}`));
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Every tab screen renders its own <ScreenHeader>.
        headerShown: false,
        tabBarLabel: tabLabel(route.name),
        tabBarActiveTintColor: colors.blue,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
        tabBarItemStyle: { paddingTop: 3 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.separator,
          borderTopWidth: 1,
          height: 78,
          paddingTop: 7,
          paddingBottom: 7,
        },
        tabBarIcon: ({ color, focused }) => (
          <View
            style={{
              backgroundColor: focused ? colors.blueSoft : "transparent",
              borderRadius: 17,
              width: 44,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={(TAB_ICONS[route.name] ?? "ellipse-outline") as any}
              size={20}
              color={focused ? colors.blue : color}
            />
          </View>
        ),
      })}
    >
      {/* Today is the salesperson's home: attendance, route, tasks, money due. */}
      {capabilities.canRunFieldDay && <Tab.Screen name="Today" component={TodayScreen} />}
      {capabilities.canOrderForRetailers ? (
        <Tab.Screen name="Retailers" component={RepRetailersScreen} />
      ) : capabilities.canRunFieldDay ? null : (
        <Tab.Screen name="Work" component={StaffHomeScreen} />
      )}
      {capabilities.canRunFieldDay && <Tab.Screen name="Activity" component={MyActivityScreen} />}
      {capabilities.canApprove && <Tab.Screen name="Approvals" component={ApprovalsScreen} />}
      <Tab.Screen name="More" component={RepAccountScreen} />
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
        <ActivityIndicator size="large" color={colors.blue} />
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
              <Stack.Screen
                name="Visit"
                component={VisitScreen}
                options={{ title: t("visit.title"), headerBackTitle: t("common.back") }}
              />
            </>
          )}
          {capabilities.canRunFieldDay && (
            <>
              <Stack.Screen
                name="Route"
                component={RouteScreen}
                options={{ title: t("route.title"), headerBackTitle: t("tabs.today") }}
              />
              <Stack.Screen
                name="Opportunities"
                component={OpportunitiesScreen}
                options={{ title: t("opportunities.title"), headerBackTitle: t("tabs.today") }}
              />
            </>
          )}
          {capabilities.canProposeRetailers && (
            <Stack.Screen
              name="AddRetailer"
              component={AddRetailerScreen}
              options={{ title: t("addRetailer.title"), headerBackTitle: t("tabs.customers") }}
            />
          )}
          {capabilities.canManageAttendance && (
            <Stack.Screen
              name="MyDay"
              component={MyDayScreen}
              options={{ title: t("myday.title"), headerBackTitle: t("tabs.more") }}
            />
          )}
          {capabilities.canRunFieldDay && (
            <Stack.Screen name="SalesKit" component={SalesKitScreen} options={{ title: "Sales Kit", headerBackTitle: t("tabs.more") }} />
          )}
          {capabilities.canSeeCustomerMap && (
            <Stack.Screen
              name="CustomerMap"
              component={CustomerMapScreen}
              options={{ title: t("map.title"), headerBackTitle: t("tabs.more") }}
            />
          )}
          {capabilities.canSubmitExpenses && (
            <Stack.Screen
              name="Expenses"
              component={ExpensesScreen}
              options={{ title: t("expenses.title"), headerBackTitle: t("tabs.more") }}
            />
          )}
          {capabilities.canRaiseIssues && (
            <Stack.Screen
              name="Issues"
              component={IssuesScreen}
              options={{ title: t("issues.title"), headerBackTitle: t("tabs.more") }}
            />
          )}
          {(capabilities.canCollect || capabilities.canOrderForRetailers) && (
            <Stack.Screen
              name="Collections"
              component={StaffHomeScreen}
              options={{ title: t("more.collections"), headerBackTitle: t("tabs.more") }}
            />
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
          <FieldProvider>
            <NavigationContainer theme={navTheme}>
              <RootNavigator />
              <StatusBar style="dark" />
            </NavigationContainer>
          </FieldProvider>
        </RepProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
