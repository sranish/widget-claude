import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { THEME, formatTokens } from "../lib/usage";

interface Props {
  grid: number[][]; // [week][day] levels, -1 = future
  total: number;
  error?: boolean;
}

const CELL = 13;
const GAP = 3;

export function UsageHeatmapWidget({ grid, total, error }: Props) {
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
        padding: 12,
      }}
      clickAction="OPEN_APP"
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
                  width: CELL,
                  height: CELL,
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
        text={error ? "offline — showing cached data" : `${formatTokens(total)} tokens · last 15 weeks`}
        style={{ fontSize: 10, color: THEME.label, marginTop: 8 }}
      />
    </FlexWidget>
  );
}
