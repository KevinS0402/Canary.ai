import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Canary.ai" }} />
      <Stack.Screen
        name="source/[sourceId]"
        options={{ title: "Source Feed" }}
      />
    </Stack>
  );
}
