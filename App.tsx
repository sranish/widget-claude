import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { buildGrid, fetchUsage, formatTokens, THEME, UsageFeed } from "./lib/usage";

const CELL = 16;
const GAP = 3;

export default function App() {
  const [feed, setFeed] = useState<UsageFeed | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage().then(setFeed).catch((e) => setError(String(e)));
  }, []);

  const built = feed ? buildGrid(feed) : null;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Text style={styles.title}>Claude Usage</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      {!feed && !error && <ActivityIndicator color={THEME.levels[3]} />}
      {built && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.card}>
              <View style={styles.grid}>
                {built.grid.map((week, w) => (
                  <View key={w} style={{ marginRight: GAP }}>
                    {week.map((level, d) => (
                      <View
                        key={d}
                        style={[
                          styles.cell,
                          { backgroundColor: level < 0 ? "transparent" : THEME.levels[level] },
                        ]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          <Text style={styles.caption}>
            {formatTokens(built.total)} tokens · last 15 weeks
          </Text>
          <Text style={styles.caption}>
            updated {new Date(feed!.updatedAt).toLocaleString()}
          </Text>
          <Text style={styles.hint}>
            Add the “Claude Usage” widget from your home screen to see this there.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F0E0C",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  title: { color: "#EDE6DD", fontSize: 22, fontWeight: "700", marginBottom: 20 },
  card: { backgroundColor: THEME.background, borderRadius: 20, padding: 14 },
  grid: { flexDirection: "row" },
  cell: { width: CELL, height: CELL, borderRadius: 4, marginBottom: GAP },
  caption: { color: THEME.label, fontSize: 12, marginTop: 10 },
  error: { color: "#E0604F", fontSize: 12, marginBottom: 10 },
  hint: { color: "#5C564F", fontSize: 12, marginTop: 24, textAlign: "center" },
});
