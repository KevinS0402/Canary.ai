import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { OverviewSource } from "@/lib/types";

type Props = {
  source: OverviewSource;
};

export function SourceOverviewCard({ source }: Props) {
  const previewText =
    source.preview.length > 0
      ? source.preview.map((entry) => entry.title).join("\n")
      : "No entries found yet.";

  return (
    <View style={styles.card}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{source.name}</Text>
        <Text numberOfLines={3} style={styles.body}>
          {previewText}
        </Text>
      </View>

      <View style={styles.buttonGroup}>
        <Pressable
          onPress={() => router.push(`/source/${source.id}`)}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>See all</Text>
        </Pressable>

        <View style={styles.countBadge}>
          <Text style={styles.countText}>Top {source.totalCount}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#FFFFFF",
    gap: 16,
  },
  textBlock: {
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1E1E1E",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: "#757575",
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#767676",
    backgroundColor: "#E3E3E3",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: "#1E1E1E",
    fontWeight: "500",
  },
  countBadge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  countText: {
    color: "#1E1E1E",
  },
  pressed: {
    opacity: 0.8,
  },
});
