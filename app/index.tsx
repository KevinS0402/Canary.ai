import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SourceOverviewCard } from "@/components/SourceOverviewCard";
import { fetchOverview } from "@/lib/api";
import type { OverviewSource } from "@/lib/types";

export default function LandingPage() {
  const [sources, setSources] = useState<OverviewSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        const data = await fetchOverview();
        if (mounted) {
          setSources(data.sources);
          setError(null);
        }
      } catch {
        if (mounted) {
          setError("Could not load data. Is backend running on port 3001?");
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
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>Canary Feed Overview</Text>

      <Text style={styles.pageSubtitle}>
        Source previews for weather channels, news, and social media.
      </Text>

      {loading ? <ActivityIndicator size="large" /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!loading && !error ? (
        <>
          <Text style={styles.pageHeader}>Ask a question</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="What's happening?"
            placeholderTextColor="#757575"
          ></TextInput>
          <View style={styles.list}>
            {sources.map((source) => (
              <SourceOverviewCard key={source.id} source={source} />
            ))}
          </View>
        </>
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
  pageHeader: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1E1E",
    marginBottom: 2,
  },
  list: {
    gap: 14,
  },
  error: {
    color: "#B3261E",
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderColor: "#E0E0E0",
    borderWidth: 1,
    marginTop: 0,
    marginBottom: 12,
    height: 44,
  },
});
