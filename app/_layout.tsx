import { Stack, useRouter } from "expo-router";
import { Text, TouchableOpacity } from "react-native";

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

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerTitle: HeaderTitle }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="source/[sourceId]"
        options={{ title: "Source Feed" }}
      />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
