# widget-claude

Expo React Native app with a home-screen widget showing daily Claude usage as a GitHub-style contribution heatmap (dark background, Claude-orange cells).

- Android widget: `react-native-android-widget` (RemoteViews bridge) via Expo config plugin.
- iOS widget: SwiftUI/WidgetKit target (iOS widgets cannot render RN); shares the same data feed.
- Data: cron on this machine runs `scripts/export-usage.mjs` (ccusage → JSON → secret GitHub Gist); widgets fetch the raw Gist URL.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
