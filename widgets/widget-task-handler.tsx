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

function cellSizeFor(props: WidgetTaskHandlerProps, weeks: number): number {
  const width = props.widgetInfo?.width ?? 320;
  const height = props.widgetInfo?.height ?? 150;
  const byWidth = (width - 2 * PADDING - GAP * (weeks - 1)) / weeks;
  const byHeight = (height - 2 * PADDING - CAPTION_DP - GAP * 6) / 7;
  return Math.max(8, Math.floor(Math.min(byWidth, byHeight)));
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      try {
        const { feed, stale } = await getFeed();
        const { grid, total } = buildGrid(feed);
        props.renderWidget(
          <UsageHeatmapWidget
            grid={grid}
            total={total}
            cellSize={cellSizeFor(props, grid.length)}
            error={stale}
          />
        );
      } catch {
        const { grid } = buildGrid({ v: 1, updatedAt: "", days: [] });
        props.renderWidget(
          <UsageHeatmapWidget grid={grid} total={0} cellSize={cellSizeFor(props, grid.length)} error />
        );
      }
      break;
    }
    default:
      break;
  }
}
