export const FEED_URL =
  "https://gist.githubusercontent.com/sranish/f5a4d116e9b80d0ddcfc4361f3ab3fed/raw/claude-usage.json";

export const WEEKS = 15; // "less crowded" — ~3.5 months
export const DAYS = WEEKS * 7;

// Dark card + Claude-orange ramp (level 0 = no usage)
export const THEME = {
  background: "#1B1917",
  levels: ["#2A2723", "#5C3527", "#96502F", "#D97757", "#FFA37A"],
  label: "#8A837B",
} as const;

export interface UsageDay {
  date: string; // YYYY-MM-DD
  tokens: number;
}

export interface UsageFeed {
  v: number;
  updatedAt: string;
  days: UsageDay[];
}

export async function fetchUsage(): Promise<UsageFeed> {
  // Cache-bust: gist raw URLs are CDN-cached for ~5 min otherwise
  const res = await fetch(`${FEED_URL}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`feed fetch failed: ${res.status}`);
  return res.json();
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Builds a WEEKS×7 grid of intensity levels (0–4), columns = weeks (oldest
 * left), rows = Mon..Sun, ending at today. Levels are quartiles of nonzero days.
 */
export function buildGrid(feed: UsageFeed, now = new Date()): { grid: number[][]; total: number } {
  const byDate = new Map(feed.days.map((d) => [d.date, d.tokens]));

  const nonzero = feed.days.map((d) => d.tokens).filter((t) => t > 0).sort((a, b) => a - b);
  const q = (p: number) => nonzero[Math.min(nonzero.length - 1, Math.floor(p * nonzero.length))] ?? 1;
  const t1 = q(0.25), t2 = q(0.5), t3 = q(0.75);
  const level = (tokens: number) =>
    tokens <= 0 ? 0 : tokens <= t1 ? 1 : tokens <= t2 ? 2 : tokens <= t3 ? 3 : 4;

  // End the grid on the Sunday of the current week (Mon = row 0)
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = (today.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  const gridStart = new Date(today);
  gridStart.setUTCDate(today.getUTCDate() - dow - (WEEKS - 1) * 7);

  let total = 0;
  const grid: number[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: number[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart);
      day.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      if (day > today) {
        col.push(-1); // future — render as empty/transparent
        continue;
      }
      const tokens = byDate.get(isoDate(day)) ?? 0;
      total += tokens;
      col.push(level(tokens));
    }
    grid.push(col);
  }
  return { grid, total };
}

export function formatTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "K";
  return String(n);
}
