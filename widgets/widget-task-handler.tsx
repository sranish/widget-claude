import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { UsageHeatmapWidget } from "./UsageHeatmapWidget";
import { buildGrid, fetchUsage, UsageFeed } from "../lib/usage";

const CACHE_KEY = "usage-feed-cache";
const CACHE_TTL_MS = 10 * 60 * 1000;

interface Cache {
  fetchedAt: number;
  feed: UsageFeed;
}

async function getFeed(): Promise<{ feed: UsageFeed; stale: boolean }> {
  const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
  const cached: Cache | null = cachedRaw ? JSON.parse(cachedRaw) : null;

  // Short-lived cache: Android fires onUpdate several times per cycle
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { feed: cached.feed, stale: false };
  }
  try {
    const feed = await fetchUsage();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), feed }));
    return { feed, stale: false };
  } catch {
    if (cached) return { feed: cached.feed, stale: true };
    throw new Error("no data");
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      try {
        const { feed, stale } = await getFeed();
        const { grid, total } = buildGrid(feed);
        props.renderWidget(<UsageHeatmapWidget grid={grid} total={total} error={stale} />);
      } catch {
        const { grid } = buildGrid({ v: 1, updatedAt: "", days: [] });
        props.renderWidget(<UsageHeatmapWidget grid={grid} total={0} error />);
      }
      break;
    }
    default:
      break;
  }
}
