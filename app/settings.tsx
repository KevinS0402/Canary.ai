import AlertCard from "@/components/SettingsCard";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export default function AlertSettings() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Update Settings</Text>

      <View style={styles.cardWrap}>
        <AlertCard />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
    backgroundColor: "#FAFAFA",
    minHeight: "100%",
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1E1E1E",
  },
  pageSubtitle: {
    fontSize: 14,
    color: "#757575",
  },
  cardWrap: {
    gap: 14,
  },
});
