import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function OrderConfirmationScreen({ route, navigation }: any) {
  const { order } = route.params;

  return (
    <View style={styles.container}>
      <Text style={styles.checkmark}>✓</Text>
      <Text style={styles.title}>Order placed</Text>
      <Text style={styles.orderId}>Order #GGN-{String(order.orderNo).padStart(5, "0")}</Text>
      <Text style={styles.total}>Total: ₹{order.orderTotal}</Text>
      <Text style={styles.hint}>
        We'll notify you as your order is confirmed, packed and sent out for delivery.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate("Main", { screen: "Orders" })}
      >
        <Text style={styles.buttonText}>View order history</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.secondary]}
        onPress={() => navigation.navigate("Main", { screen: "Products" })}
      >
        <Text style={[styles.buttonText, styles.secondaryText]}>Continue shopping</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#fff" },
  checkmark: { fontSize: 56, color: "#1a5c2e", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  orderId: { fontSize: 14, color: "#777", marginTop: 8 },
  total: { fontSize: 18, fontWeight: "600", marginTop: 12 },
  hint: { textAlign: "center", color: "#666", marginTop: 12, marginBottom: 32 },
  button: { backgroundColor: "#1a5c2e", borderRadius: 8, padding: 14, width: "100%", alignItems: "center", marginBottom: 12 },
  buttonText: { color: "#fff", fontWeight: "600" },
  secondary: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#1a5c2e" },
  secondaryText: { color: "#1a5c2e" },
});
