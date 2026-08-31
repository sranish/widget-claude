#!/usr/bin/env node
/**
 * Exports daily Claude usage (from Claude Code logs via ccusage) to a secret
 * GitHub Gist that the mobile widgets fetch.
 *
 * Usage:  node scripts/export-usage.mjs
 * Cron:   run daily/hourly; idempotent. Gist id is cached in ~/.config/claude-usage-widget/gist-id
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const CONF_DIR = join(homedir(), ".config", "claude-usage-widget");
const GIST_ID_FILE = join(CONF_DIR, "gist-id");
const GIST_FILENAME = "claude-usage.json";
const DAYS_KEPT = 140; // 20 weeks — more than the widget shows

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...opts });
}

// 1. Pull daily usage. Count only Claude models (logs can contain other agents' models).
const raw = JSON.parse(sh("npx", ["-y", "ccusage@latest", "daily", "--json"]));
const days = (raw.daily ?? [])
  .map((d) => {
    const claudeTokens = (d.modelBreakdowns ?? [])
      .filter((m) => /claude/i.test(m.modelName ?? ""))
      .reduce(
        (sum, m) =>
          sum +
          (m.inputTokens ?? 0) +
          (m.outputTokens ?? 0) +
          (m.cacheCreationTokens ?? 0) +
          (m.cacheReadTokens ?? 0),
        0
      );
    return { date: d.period, tokens: claudeTokens };
  })
  .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date ?? ""))
  .sort((a, b) => a.date.localeCompare(b.date))
  .slice(-DAYS_KEPT);

// 1b. Fetch plan limit utilization via the same endpoint Claude Code's /usage uses.
// Unofficial; degrade gracefully if shape changes. Token never leaves this machine.
async function fetchLimits() {
  try {
    const creds = JSON.parse(readFileSync(join(homedir(), ".claude", ".credentials.json"), "utf8"));
    const token = creds?.claudeAiOauth?.accessToken ?? creds?.accessToken;
    if (!token) return undefined;
    const res = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) {
      console.error(`limits fetch: HTTP ${res.status}`);
      return undefined;
    }
    const data = await res.json();
    if (process.argv.includes("--probe")) console.error(JSON.stringify(data, null, 2));

    // Preferred: the structured `limits` array (kind: session | weekly_all | weekly_scoped)
    if (Array.isArray(data?.limits) && data.limits.length) {
      const KIND_LABELS = { session: "Current session", weekly_all: "All models (week)" };
      return data.limits
        .filter((l) => typeof l?.percent === "number")
        .map((l) => ({
          label:
            KIND_LABELS[l.kind] ??
            (l.scope?.model?.display_name
              ? `${l.scope.model.display_name} (week)`
              : l.kind.replace(/_/g, " ")),
          pct: Math.round(l.percent),
          resetsAt: l.resets_at ?? undefined,
        }));
    }
    // Fallback: legacy top-level utilization objects
    const LABELS = { five_hour: "Current session", seven_day: "All models (week)" };
    const limits = [];
    for (const [key, val] of Object.entries(LABELS)) {
      const pct = data?.[key]?.utilization;
      if (typeof pct !== "number") continue;
      limits.push({ label: val, pct: Math.round(pct), resetsAt: data[key].resets_at ?? undefined });
    }
    return limits.length ? limits : undefined;
  } catch (e) {
    console.error(`limits fetch failed: ${e.message}`);
    return undefined;
  }
}

const limits = await fetchLimits();
const payload = JSON.stringify(
  { v: 1, updatedAt: new Date().toISOString(), days, ...(limits ? { limits } : {}) },
  null,
  0
);
const tmpFile = join(tmpdir(), GIST_FILENAME);
writeFileSync(tmpFile, payload);

// 2. Create or update the secret gist.
mkdirSync(CONF_DIR, { recursive: true });
let gistId = existsSync(GIST_ID_FILE) ? readFileSync(GIST_ID_FILE, "utf8").trim() : "";

if (gistId) {
  sh("gh", ["gist", "edit", gistId, "--add", tmpFile]);
} else {
  const out = sh("gh", ["gist", "create", tmpFile, "--desc", "claude usage widget feed"]);
  gistId = out.trim().split("/").pop();
  writeFileSync(GIST_ID_FILE, gistId + "\n");
}

const user = sh("gh", ["api", "user", "-q", ".login"]).trim();
const rawUrl = `https://gist.githubusercontent.com/${user}/${gistId}/raw/${GIST_FILENAME}`;
console.log(`updated ${days.length} days -> ${rawUrl}`);
