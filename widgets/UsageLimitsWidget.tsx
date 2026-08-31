import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import { THEME, UsageLimit, formatReset } from "../lib/usage";

interface Props {
  limits: UsageLimit[];
  barWidth: number; // dp, computed from widget width
}

function LimitRow({ limit, barWidth }: { limit: UsageLimit; barWidth: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(limit.pct)));
  const fill = Math.max(3, Math.round((barWidth * pct) / 100));
  const reset = formatReset(limit.resetsAt);
  return (
    <FlexWidget style={{ flexDirection: "column", marginBottom: 9, width: "match_parent" }}>
      <FlexWidget
        style={{
          flexDirection: "row",
          width: "match_parent",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <TextWidget text={limit.label} style={{ fontSize: 12, color: "#EDE6DD" }} />
        <TextWidget text={`${pct}%`} style={{ fontSize: 12, color: THEME.levels[3] }} />
      </FlexWidget>
      <FlexWidget
        style={{
          width: barWidth,
          height: 5,
          borderRadius: 3,
          backgroundColor: THEME.levels[0],
          flexDirection: "row",
        }}
      >
        <FlexWidget
          style={{
            width: fill,
            height: 5,
            borderRadius: 3,
            backgroundColor: pct >= 85 ? "#E0604F" : THEME.levels[3],
          }}
        />
      </FlexWidget>
      {reset !== "" && (
        <TextWidget text={reset} style={{ fontSize: 9, color: THEME.label, marginTop: 2 }} />
      )}
    </FlexWidget>
  );
}

export function UsageLimitsWidget({ limits, barWidth }: Props) {
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: THEME.background,
        borderRadius: 24,
        flexDirection: "column",
        padding: 14,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: "https://claude.ai/settings/usage" }}
    >
      <FlexWidget
        style={{
          flexDirection: "row",
          width: "match_parent",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <TextWidget text="Limits" style={{ fontSize: 11, color: THEME.label }} />
        <TextWidget
          text="◄ graph"
          clickAction="FLIP_TO_GRID"
          style={{ fontSize: 11, color: THEME.label, paddingLeft: 16, paddingBottom: 8 }}
        />
      </FlexWidget>
      {limits.length === 0 ? (
        <TextWidget
          text="No limit data yet — run the exporter on your computer"
          style={{ fontSize: 11, color: THEME.label }}
        />
      ) : (
        limits.slice(0, 3).map((limit, i) => <LimitRow key={i} limit={limit} barWidth={barWidth} />)
      )}
    </FlexWidget>
  );
}
