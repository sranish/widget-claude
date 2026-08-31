import WidgetKit
import SwiftUI

// MARK: - Feed

let feedURL = URL(string: "https://gist.githubusercontent.com/sranish/f5a4d116e9b80d0ddcfc4361f3ab3fed/raw/claude-usage.json")!
let weeksShown = 15

struct UsageDay: Decodable {
  let date: String
  let tokens: Int
}

struct Feed: Decodable {
  let updatedAt: String
  let days: [UsageDay]
}

// MARK: - Grid

/// Mirrors lib/usage.ts buildGrid: [week][day] levels 0-4, -1 for future days.
func buildGrid(feed: Feed, now: Date = Date()) -> (grid: [[Int]], total: Int) {
  var byDate: [String: Int] = [:]
  for d in feed.days { byDate[d.date] = d.tokens }

  let nonzero = feed.days.map(\.tokens).filter { $0 > 0 }.sorted()
  func q(_ p: Double) -> Int {
    guard !nonzero.isEmpty else { return 1 }
    return nonzero[min(nonzero.count - 1, Int(p * Double(nonzero.count)))]
  }
  let t1 = q(0.25), t2 = q(0.5), t3 = q(0.75)
  func level(_ tokens: Int) -> Int {
    if tokens <= 0 { return 0 }
    if tokens <= t1 { return 1 }
    if tokens <= t2 { return 2 }
    if tokens <= t3 { return 3 }
    return 4
  }

  var cal = Calendar(identifier: .gregorian)
  cal.timeZone = TimeZone(identifier: "UTC")!
  let fmt = DateFormatter()
  fmt.dateFormat = "yyyy-MM-dd"
  fmt.timeZone = cal.timeZone

  let today = cal.startOfDay(for: now)
  let weekday = cal.component(.weekday, from: today) // Sun=1..Sat=7
  let dow = (weekday + 5) % 7 // Mon=0..Sun=6
  guard let gridStart = cal.date(byAdding: .day, value: -(dow + (weeksShown - 1) * 7), to: today)
  else { return ([], 0) }

  var total = 0
  var grid: [[Int]] = []
  for w in 0..<weeksShown {
    var col: [Int] = []
    for d in 0..<7 {
      guard let day = cal.date(byAdding: .day, value: w * 7 + d, to: gridStart) else { continue }
      if day > today {
        col.append(-1)
        continue
      }
      let tokens = byDate[fmt.string(from: day)] ?? 0
      total += tokens
      col.append(level(tokens))
    }
    grid.append(col)
  }
  return (grid, total)
}

func formatTokens(_ n: Int) -> String {
  if n >= 1_000_000_000 { return String(format: "%.1fB", Double(n) / 1e9) }
  if n >= 1_000_000 { return String(format: "%.1fM", Double(n) / 1e6) }
  if n >= 1_000 { return String(format: "%.0fK", Double(n) / 1e3) }
  return String(n)
}

// MARK: - Timeline

struct UsageEntry: TimelineEntry {
  let date: Date
  let grid: [[Int]]
  let total: Int
  let stale: Bool
}

let placeholderEntry = UsageEntry(
  date: Date(),
  grid: (0..<weeksShown).map { _ in (0..<7).map { _ in Int.random(in: 0...4) } },
  total: 0,
  stale: false
)

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> UsageEntry { placeholderEntry }

  func getSnapshot(in context: Context, completion: @escaping (UsageEntry) -> Void) {
    completion(placeholderEntry)
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<UsageEntry>) -> Void) {
    var request = URLRequest(url: feedURL)
    request.cachePolicy = .reloadIgnoringLocalCacheData
    URLSession.shared.dataTask(with: request) { data, _, _ in
      let refresh = Date().addingTimeInterval(30 * 60)
      if let data, let feed = try? JSONDecoder().decode(Feed.self, from: data) {
        let built = buildGrid(feed: feed)
        let entry = UsageEntry(date: Date(), grid: built.grid, total: built.total, stale: false)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
      } else {
        let entry = UsageEntry(date: Date(), grid: [], total: 0, stale: true)
        completion(Timeline(entries: [entry], policy: .after(refresh)))
      }
    }.resume()
  }
}

// MARK: - View

let levelColors: [Color] = [
  Color(red: 0.165, green: 0.153, blue: 0.137), // 0 — empty
  Color(red: 0.361, green: 0.208, blue: 0.153), // 1
  Color(red: 0.588, green: 0.314, blue: 0.184), // 2
  Color(red: 0.851, green: 0.467, blue: 0.341), // 3 — Claude orange
  Color(red: 1.0, green: 0.639, blue: 0.478),   // 4
]
let cardBackground = Color(red: 0.106, green: 0.098, blue: 0.090)
let labelColor = Color(red: 0.541, green: 0.514, blue: 0.482)

struct HeatmapView: View {
  let entry: UsageEntry

  var body: some View {
    VStack(spacing: 6) {
      if entry.grid.isEmpty {
        Text("Claude usage unavailable")
          .font(.system(size: 11))
          .foregroundColor(labelColor)
      } else {
        GeometryReader { geo in
          let gap: CGFloat = 3
          let cols = CGFloat(entry.grid.count)
          let cell = min(
            (geo.size.width - gap * (cols - 1)) / cols,
            (geo.size.height - gap * 6) / 7
          )
          HStack(alignment: .top, spacing: gap) {
            ForEach(entry.grid.indices, id: \.self) { w in
              VStack(spacing: gap) {
                ForEach(entry.grid[w].indices, id: \.self) { d in
                  let level = entry.grid[w][d]
                  RoundedRectangle(cornerRadius: 3)
                    .fill(level < 0 ? Color.clear : levelColors[level])
                    .frame(width: cell, height: cell)
                }
              }
            }
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        }
        Text("\(formatTokens(entry.total)) tokens · last 15 weeks")
          .font(.system(size: 10))
          .foregroundColor(labelColor)
      }
    }
    .padding(4)
    .containerBackground(cardBackground, for: .widget)
  }
}

// MARK: - Widget

struct ClaudeUsageWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "ClaudeUsageWidget", provider: Provider()) { entry in
      HeatmapView(entry: entry)
    }
    .configurationDisplayName("Claude Usage")
    .description("Daily Claude usage as a contribution heatmap.")
    .supportedFamilies([.systemMedium, .systemLarge])
  }
}

@main
struct ClaudeUsageWidgetBundle: WidgetBundle {
  var body: some Widget {
    ClaudeUsageWidget()
  }
}
