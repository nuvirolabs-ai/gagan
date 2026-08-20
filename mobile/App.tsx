import React from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { CartProvider } from "./src/context/CartContext";
import TabBar from "./src/components/TabBar";
import { colors } from "./src/theme";

import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CatalogScreen from "./src/screens/CatalogScreen";
import ProductDetailScreen from "./src/screens/ProductDetailScreen";
import CartScreen from "./src/screens/CartScreen";
import OrderConfirmationScreen from "./src/screens/OrderConfirmationScreen";
import OrderHistoryScreen from "./src/screens/OrderHistoryScreen";
import OrderDetailScreen from "./src/screens/OrderDetailScreen";
import LedgerScreen from "./src/screens/LedgerScreen";
import PayScreen from "./src/screens/PayScreen";
import DeliveryTrackingScreen from "./src/screens/DeliveryTrackingScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

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

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      // Every tab screen renders its own <ScreenHeader>, so the navigator's
      // header would just duplicate the title.
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Products" component={CatalogScreen} />
      <Tab.Screen name="Cart" component={CartScreen} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} />
      <Tab.Screen name="Account" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { retailer, loading } = useAuth();

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
      {!retailer ? (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="ProductDetail"
            component={ProductDetailScreen}
            options={{ title: "Product", headerBackTitle: "Back" }}
          />
          <Stack.Screen name="Ledger" component={LedgerScreen} options={{ title: "Ledger", headerBackTitle: "Back" }} />
          <Stack.Screen name="Pay" component={PayScreen} options={{ title: "Pay dues", headerBackTitle: "Back" }} />
          <Stack.Screen
            name="OrderDetail"
            component={OrderDetailScreen}
            options={{ title: "Order details", headerBackTitle: "Orders" }}
          />
          <Stack.Screen
            name="OrderConfirmation"
            component={OrderConfirmationScreen}
            options={{ title: "Order placed", headerBackVisible: false }}
          />
          <Stack.Screen
            name="DeliveryTracking"
            component={DeliveryTrackingScreen}
            options={{ title: "Delivery status", headerBackTitle: "Back" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
