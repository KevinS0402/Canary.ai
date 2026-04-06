import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AlertCard() {
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [severe, setSevere] = useState(true);
  const [safety, setSafety] = useState(true);
  const [national, setNational] = useState(true);

  // New source toggles (selected by default)
  const [weatherSource, setWeatherSource] = useState(true);
  const [socialSource, setSocialSource] = useState(true);
  const [newsSource, setNewsSource] = useState(true);

  const toggle = (setter: (v: boolean) => void, v: boolean) => setter(!v);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>Location</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Address"
        placeholderTextColor="#BDBDBD"
        value={location}
        onChangeText={setLocation}
      />

      <View style={[styles.row, { marginTop: 12 }]}>
        <Text style={styles.label}>Date (for testing)</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder="Type date here."
        placeholderTextColor="#BDBDBD"
        value={date}
        onChangeText={setDate}
      />

      <View style={styles.sourcesSection}>
        <Text style={styles.sourcesHeader}>Select sources of information</Text>
        <View style={styles.sourceRow}>
          <TouchableOpacity
            style={[
              styles.sourceButton,
              weatherSource && styles.sourceButtonActive,
            ]}
            onPress={() => setWeatherSource(!weatherSource)}
          >
            <Text
              style={[
                styles.sourceButtonText,
                weatherSource && styles.sourceButtonTextActive,
              ]}
            >
              Weather
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.sourceButton,
              socialSource && styles.sourceButtonActive,
            ]}
            onPress={() => setSocialSource(!socialSource)}
          >
            <Text
              style={[
                styles.sourceButtonText,
                socialSource && styles.sourceButtonTextActive,
              ]}
            >
              Social Media
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sourceButton,
              newsSource && styles.sourceButtonActive,
            ]}
            onPress={() => setNewsSource(!newsSource)}
          >
            <Text
              style={[
                styles.sourceButtonText,
                newsSource && styles.sourceButtonTextActive,
              ]}
            >
              News Reports
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.checkboxList}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => toggle(setSevere, severe)}
        >
          <View style={[styles.checkbox, severe && styles.checkboxChecked]}>
            {severe ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <View style={styles.checkboxText}>
            <Text style={styles.checkboxTitle}>Severe Weather</Text>
            <Text style={styles.checkboxSubtitle}>
              Thunderstorms, tornadoes, winter storms, etc.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => toggle(setSafety, safety)}
        >
          <View style={[styles.checkbox, safety && styles.checkboxChecked]}>
            {safety ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <View style={styles.checkboxText}>
            <Text style={styles.checkboxTitle}>Public Safety Alert</Text>
            <Text style={styles.checkboxSubtitle}>
              Amber Alerts, Silver Alerts, etc.
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => toggle(setNational, national)}
        >
          <View style={[styles.checkbox, national && styles.checkboxChecked]}>
            {national ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <View style={styles.checkboxText}>
            <Text style={styles.checkboxTitle}>National Alert</Text>
            <Text style={styles.checkboxSubtitle}>Major emergencies</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.saveBtn}
        onPress={() => {
          // save handler: collect selections here
          const payload = {
            location,
            date,
            categories: { severe, safety, national },
            sources: {
              weather: weatherSource,
              social: socialSource,
              news: newsSource,
            },
          };
          console.log("Save settings:", payload);
        }}
      >
        <Text style={styles.saveText}>✓ Save Changes</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    padding: 16,
    width: "100%",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { fontSize: 13, color: "#666", marginBottom: 6 },
  input: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFF",
    height: 42,
    color: "#111",
  },
  sourcesSection: { marginTop: 12 },
  sourcesHeader: { fontSize: 13, color: "#666", marginBottom: 8 },
  sourceRow: { flexDirection: "row", gap: 8 },
  sourceButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFF",
  },
  sourceButtonActive: {
    backgroundColor: "#222",
    borderColor: "#222",
  },
  sourceButtonText: { color: "#333", fontWeight: "600" },
  sourceButtonTextActive: { color: "#FFF" },
  checkboxList: { marginTop: 12 },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#BDBDBD",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
    backgroundColor: "#FFF",
  },
  checkboxChecked: {
    backgroundColor: "#222",
    borderColor: "#222",
  },
  checkMark: { color: "#FFF", fontWeight: "700" },
  checkboxText: { flex: 1 },
  checkboxTitle: { fontSize: 14, fontWeight: "700", color: "#111" },
  checkboxSubtitle: { fontSize: 12, color: "#6f6f6f", marginTop: 2 },
  saveBtn: {
    marginTop: 18,
    backgroundColor: "#222",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  saveText: { color: "#FFF", fontWeight: "700" },
});
