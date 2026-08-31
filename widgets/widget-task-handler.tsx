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

const GAP = 3;
const PADDING = 6;
const CAPTION_DP = 16;

/**
 * Smart sizing: cell size comes from widget height (7 rows always fit),
 * then the number of week columns adapts to the available width.
 */
function layoutFor(props: WidgetTaskHandlerProps): { cellSize: number; weeks: number } {
  const width = props.widgetInfo?.width ?? 320;
  const height = props.widgetInfo?.height ?? 150;
  const cellSize = Math.max(
    10,
    Math.min(22, Math.floor((height - 2 * PADDING - CAPTION_DP - GAP * 6) / 7))
  );
  const weeks = Math.max(
    4,
    Math.min(20, Math.floor((width - 2 * PADDING + GAP) / (cellSize + GAP)))
  );
  return { cellSize, weeks };
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const { cellSize, weeks } = layoutFor(props);
      try {
        const { feed, stale } = await getFeed();
        const { grid, total } = buildGrid(feed, new Date(), weeks);
        props.renderWidget(
          <UsageHeatmapWidget
            grid={grid}
            total={total}
            cellSize={cellSize}
            updatedAt={feed.updatedAt}
            error={stale}
          />
        );
      } catch {
        const { grid } = buildGrid({ v: 1, updatedAt: "", days: [] }, new Date(), weeks);
        props.renderWidget(<UsageHeatmapWidget grid={grid} total={0} cellSize={cellSize} error />);
      }
      break;
    }
    default:
      break;
  }
}
