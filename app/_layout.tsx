import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

import { SettingsProvider } from "@/lib/settings-context";

function HeaderTitle() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.replace("/")}
      style={{ padding: 4 }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Canary.ai</Text>
    </TouchableOpacity>
  );
}

function HeaderSettingsButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push("/settings")}
      style={{ padding: 10 }}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
    >
      <Ionicons name="settings-outline" size={22} color="#1E1E1E" />
    </TouchableOpacity>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <Stack
        screenOptions={{
          headerTitle: HeaderTitle,
          headerRight: HeaderSettingsButton,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="source/[sourceId]"
          options={{ title: "Source Feed" }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Settings",
            headerRight: () => null,
          }}
        />
      </Stack>
    </SettingsProvider>
  );
}
