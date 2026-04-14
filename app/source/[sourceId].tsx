import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FeedEntryCard } from "@/components/FeedEntryCard";
import { fetchSourceFeed, resolveSourceId } from "@/lib/api";
import { filterFeedItemsByCutoffDate } from "@/lib/date-filter";
import { useSettings } from "@/lib/settings-context";
import type { FeedItem } from "@/lib/types";

export default function SourcePage() {
  const { selectedDate } = useSettings();
  const params = useLocalSearchParams<{ sourceId?: string }>();
  const safeSourceId = useMemo(
    () => resolveSourceId(params.sourceId || ""),
    [params.sourceId],
  );

  const [title, setTitle] = useState("Source Feed");
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filteredItems = filterFeedItemsByCutoffDate(items, selectedDate);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchSourceFeed(safeSourceId);
        if (mounted) {
          setTitle(`${data.name} Feed`);
          setItems(data.items);
          setError(null);
        }
      } catch {
        if (mounted) {
          setError("Could not load source feed.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [safeSourceId]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>{title}</Text>
      <Text style={styles.pageSubtitle}>
        Top five entries currently in the database.
      </Text>

      {loading ? <ActivityIndicator size="large" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error ? (
        <View style={styles.list}>
          {filteredItems.length === 0 ? (
            <Text style={styles.emptyState}>
              No entries are available on or before the selected date.
            </Text>
          ) : null}
          {filteredItems.map((item) => (
            <FeedEntryCard key={item.id} item={item} sourceId={safeSourceId} />
          ))}
        </View>
      ) : null}
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
  list: {
    gap: 14,
  },
  error: {
    color: "#B3261E",
  },
  emptyState: {
    color: "#757575",
  },
});
