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

const payload = JSON.stringify({ v: 1, updatedAt: new Date().toISOString(), days }, null, 0);
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
