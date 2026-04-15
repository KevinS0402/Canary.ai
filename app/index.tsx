import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SourceOverviewCard } from "@/components/SourceOverviewCard";
import { useSettings } from "@/lib/settings-context";
import { fetchOverview, fetchSearchResults } from "@/lib/api";
import type { OverviewSource } from "@/lib/types";

// expandable text helper
const ExpandableText = ({ text }: { text: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const CHAR_LIMIT = 120;

  if (!text) return null;

  // if text is short, just render it normally
  if (text.length <= CHAR_LIMIT) {
    return <Text style={styles.resultBody}>{text}</Text>;
  }

  // if long, render the truncated version with a toggle
  return (
    <View>
      <Text style={styles.resultBody}>
        {isExpanded ? text : `${text.substring(0, CHAR_LIMIT)}...`}
      </Text>
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.expandButton}
      >
        <Text style={styles.expandButtonText}>
          {isExpanded ? "Show less" : "Read more"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default function LandingPage() {
  const { selectedDate } = useSettings();
  const [sources, setSources] = useState<OverviewSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // search states
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchOverview(selectedDate);
        if (mounted) {
          setSources(data.sources);
          setError(null);
        }
      } catch {
        if (mounted)
          setError("Could not load data. Is backend running on port 3001?");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const results = await fetchSearchResults(query);
      setSearchResults(results);
    } catch (err) {
      console.error(err);
      setError("Search failed. Check your backend terminal.");
    } finally {
      setIsSearching(false);
    }
  };

  // clear search handler
  const clearSearch = () => {
    setQuery("");
    setSearchResults(null);
    setIsSearching(false);
  };

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
<<<<<<< HEAD
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="What's happening?"
            placeholderTextColor="#757575"
          ></TextInput>
          {sources.length === 0 && selectedDate ? (
            <Text style={styles.emptyState}>
              No entries are available on or before the selected date.
            </Text>
          ) : null}
          <View style={styles.list}>
            {sources.map((source) => (
              <SourceOverviewCard key={source.id} source={source} />
            ))}
=======

          {/* search bar container with clear button AND search button */}
          <View style={styles.searchRow}>
            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                placeholder="What's happening?"
                placeholderTextColor="#757575"
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity
                  onPress={clearSearch}
                  style={styles.clearIcon}
                >
                  <Text style={styles.clearIconText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              onPress={handleSearch}
              style={styles.searchButton}
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
>>>>>>> 7872e4a (completed search function which displays results ordered in relevancy, added search bar for intuitive searching, added expand option to show full text)
          </View>

          {isSearching ? (
            <ActivityIndicator
              size="large"
              color="#0000ff"
              style={{ marginTop: 20 }}
            />
          ) : searchResults ? (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsHeader}>Search Results</Text>

              {/* Weather Alerts */}
              {searchResults.weather?.length > 0 && (
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryTitle}>🚨 Weather Alerts</Text>
                  {searchResults.weather.map((item: any) => (
                    <View key={item.id} style={styles.resultCard}>
                      <Text style={styles.resultTitle}>{item.event_name}</Text>
                      {/* expandabletext */}
                      <ExpandableText text={item.summary} />
                    </View>
                  ))}
                </View>
              )}

              {/* News Articles */}
              {searchResults.news?.length > 0 && (
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryTitle}>📰 News Updates</Text>
                  {searchResults.news.map((item: any) => (
                    <View key={item.id} style={styles.resultCard}>
                      <Text style={styles.resultTitle}>
                        {item.title} ({item.publisher})
                      </Text>
                      <ExpandableText text={item.summary} />
                    </View>
                  ))}
                </View>
              )}

              {/* Tweets */}
              {searchResults.tweets?.length > 0 && (
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryTitle}>🐦 X / Twitter</Text>
                  {searchResults.tweets.map((item: any) => (
                    <View key={item.tweet_id} style={styles.resultCard}>
                      <Text style={styles.resultTitle}>@{item.author}</Text>
                      <ExpandableText text={item.summary || item.raw_text} />
                    </View>
                  ))}
                </View>
              )}

              {/* Bluesky */}
              {searchResults.bluesky?.length > 0 && (
                <View style={styles.categoryBlock}>
                  <Text style={styles.categoryTitle}>🦋 Bluesky</Text>
                  {searchResults.bluesky.map((item: any) => (
                    <View key={item.post_cid} style={styles.resultCard}>
                      <Text style={styles.resultTitle}>@{item.author}</Text>
                      <ExpandableText text={item.raw_text} />
                    </View>
                  ))}
                </View>
              )}

              {/* Empty State */}
              {Object.values(searchResults).every(
                (arr: any) => arr.length === 0,
              ) && (
                <Text style={styles.pageSubtitle}>
                  No semantic matches found for that query.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.list}>
              {sources.map((source) => (
                <SourceOverviewCard key={source.id} source={source} />
              ))}
            </View>
          )}
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
<<<<<<< HEAD
  emptyState: {
    color: "#757575",
=======
  // NEW: Search Row Layout
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // search bar styles
  searchContainer: {
    flex: 1, // Tells the input to take up the remaining space next to the button
    position: "relative",
    justifyContent: "center",
>>>>>>> 7872e4a (completed search function which displays results ordered in relevancy, added search bar for intuitive searching, added expand option to show full text)
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 40, // Make room for the clear icon
    borderColor: "#E0E0E0",
    borderWidth: 1,
    height: 44,
  },
  clearIcon: {
    position: "absolute",
    right: 12,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  clearIconText: {
    color: "#757575",
    fontSize: 16,
    fontWeight: "bold",
  },
  // NEW: Search Button Styles
  searchButton: {
    backgroundColor: "#0066CC",
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // results styles
  resultsContainer: {
    gap: 20,
    paddingBottom: 40,
  },
  resultsHeader: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E1E1E",
  },
  categoryBlock: {
    gap: 8,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#424242",
    marginBottom: 4,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 8,
    borderColor: "#E0E0E0",
    borderWidth: 1,
    gap: 4,
  },
  resultTitle: {
    fontWeight: "600",
    color: "#1E1E1E",
  },
  resultBody: {
    color: "#424242",
    fontSize: 14,
    lineHeight: 20,
  },
  // expandable button styles
  expandButton: {
    marginTop: 6,
    alignSelf: "flex-start",
  },
  expandButtonText: {
    color: "#0066CC", // a nice clickable blue
    fontWeight: "600",
    fontSize: 14,
  },
});
