import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fetchSourceItemDetail } from "@/lib/api";
import type { FeedItem, SourceId } from "@/lib/types";

type Props = {
  item: FeedItem;
  sourceId: SourceId;
};

export function FeedEntryCard({ item, sourceId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [fullBody, setFullBody] = useState<string | null>(null);
  const [loadingFullBody, setLoadingFullBody] = useState(false);
  const [fullBodyError, setFullBodyError] = useState<string | null>(null);

  const displayBody = expanded ? fullBody || item.body : item.body;

  async function openSource() {
    if (!item.url) return;
    await Linking.openURL(item.url);
  }

  async function toggleExpanded() {
    if (expanded) {
      setExpanded(false);
      return;
    }

    setExpanded(true);

    if (fullBody || loadingFullBody) {
      return;
    }

    try {
      setLoadingFullBody(true);
      setFullBodyError(null);
      const detail = await fetchSourceItemDetail(sourceId, item.id);
      setFullBody(detail.fullBody);
    } catch {
      setFullBodyError("Could not load full text.");
    } finally {
      setLoadingFullBody(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{item.title}</Text>
        <Text numberOfLines={expanded ? undefined : 4} style={styles.body}>
          {displayBody}
        </Text>
        {expanded && loadingFullBody ? (
          <Text style={styles.metaText}>Loading full text...</Text>
        ) : null}
        {expanded && fullBodyError ? (
          <Text style={styles.errorText}>{fullBodyError}</Text>
        ) : null}
      </View>

      <View style={styles.buttonGroup}>
        <Pressable
          onPress={toggleExpanded}
          style={({ pressed }) => [
            styles.actionButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.actionText}>
            {expanded ? "See less" : "See all"}
          </Text>
        </Pressable>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.subtitle}</Text>
        </View>

        {item.url ? (
          <Pressable
            accessibilityLabel="Open source link"
            onPress={openSource}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="open-outline" size={18} color="#1E1E1E" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 16,
  },
  textBlock: {
    gap: 8,
  },
  title: {
    color: "#1E1E1E",
    fontSize: 18,
    fontWeight: "600",
  },
  body: {
    color: "#757575",
    lineHeight: 20,
    fontSize: 14,
  },
  metaText: {
    color: "#757575",
    fontSize: 12,
  },
  errorText: {
    color: "#B3261E",
    fontSize: 12,
  },
  buttonGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#767676",
    backgroundColor: "#E3E3E3",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionText: {
    color: "#1E1E1E",
    fontWeight: "500",
  },
  badge: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexShrink: 1,
  },
  badgeText: {
    color: "#1E1E1E",
    fontSize: 12,
  },
  iconButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#767676",
    backgroundColor: "#FFFFFF",
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.85,
  },
});
