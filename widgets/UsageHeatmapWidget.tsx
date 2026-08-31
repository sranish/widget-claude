import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { THEME, formatTokens } from "../lib/usage";

interface Props {
  grid: number[][]; // [week][day] levels, -1 = future
  total: number;
  cellSize?: number;
  updatedAt?: string;
  error?: boolean;
}

const GAP = 3;
const PADDING = 6;

export function UsageHeatmapWidget({ grid, total, cellSize = 13, updatedAt, error }: Props) {
  const updated = updatedAt
    ? new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: THEME.background,
        borderRadius: 24,
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: PADDING,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: "https://claude.ai/settings/usage" }}
    >
      <FlexWidget style={{ flexDirection: "row" }}>
        {grid.map((week, w) => (
          <FlexWidget
            key={`w${w}`}
            style={{ flexDirection: "column", marginRight: w === grid.length - 1 ? 0 : GAP }}
          >
            {week.map((level, d) => (
              <FlexWidget
                key={`d${d}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 3,
                  marginBottom: d === 6 ? 0 : GAP,
                  backgroundColor: level < 0 ? THEME.background : THEME.levels[level],
                }}
              />
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
      <TextWidget
        text={
          error
            ? "offline — showing cached data"
            : `${formatTokens(total)} tokens · ${grid.length} wks${updated ? ` · upd ${updated}` : ""}`
        }
        style={{ fontSize: 9, color: THEME.label, marginTop: 4 }}
      />
    </FlexWidget>
  );
}
