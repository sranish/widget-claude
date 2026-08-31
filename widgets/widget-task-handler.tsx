import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { UsageHeatmapWidget } from "./UsageHeatmapWidget";
import { UsageLimitsWidget } from "./UsageLimitsWidget";
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
const HEADER_DP = 18;
const CAPTION_DP = 16;

/**
 * Smart sizing: cell size comes from widget height (7 rows always fit),
 * then the number of week columns adapts to the available width.
 */
function layoutFor(props: WidgetTaskHandlerProps): {
  cellSize: number;
  weeks: number;
  barWidth: number;
} {
  const width = props.widgetInfo?.width ?? 320;
  const height = props.widgetInfo?.height ?? 150;
  const cellSize = Math.max(
    10,
    Math.min(22, Math.floor((height - 2 * PADDING - HEADER_DP - CAPTION_DP - GAP * 6) / 7))
  );
  const weeks = Math.max(
    4,
    Math.min(20, Math.floor((width - 2 * PADDING + GAP) / (cellSize + GAP)))
  );
  const barWidth = Math.max(80, width - 2 * 14);
  return { cellSize, weeks, barWidth };
}

function faceKey(widgetId: number): string {
  return `widget-face-${widgetId}`;
}

async function renderFace(props: WidgetTaskHandlerProps, face: string) {
  const { cellSize, weeks, barWidth } = layoutFor(props);
  let feed: UsageFeed = { v: 1, updatedAt: "", days: [] };
  let stale = false;
  let failed = false;
  try {
    const got = await getFeed();
    feed = got.feed;
    stale = got.stale;
  } catch {
    failed = true;
  }

  if (face === "limits") {
    props.renderWidget(<UsageLimitsWidget limits={feed.limits ?? []} barWidth={barWidth} />);
    return;
  }
  const { grid, total } = buildGrid(feed, new Date(), weeks);
  props.renderWidget(
    <UsageHeatmapWidget
      grid={grid}
      total={total}
      cellSize={cellSize}
      updatedAt={feed.updatedAt || undefined}
      error={stale || failed}
    />
  );
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetId = props.widgetInfo?.widgetId ?? 0;
  switch (props.widgetAction) {
    case "WIDGET_ADDED":
    case "WIDGET_UPDATE":
    case "WIDGET_RESIZED": {
      const face = (await AsyncStorage.getItem(faceKey(widgetId))) ?? "grid";
      await renderFace(props, face);
      break;
    }
    case "WIDGET_CLICK": {
      if (props.clickAction === "FLIP_TO_LIMITS" || props.clickAction === "FLIP_TO_GRID") {
        const face = props.clickAction === "FLIP_TO_LIMITS" ? "limits" : "grid";
        await AsyncStorage.setItem(faceKey(widgetId), face);
        await renderFace(props, face);
      }
      break;
    }
    default:
      break;
  }
}
