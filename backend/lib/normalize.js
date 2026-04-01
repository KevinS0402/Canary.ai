export function normalizeSourceId(sourceId) {
  if (sourceId === "weather-channels") return "weather";
  if (sourceId === "social-media") return "social";
  return sourceId;
}

function excerpt(text, max = 160) {
  if (!text) return "No preview available.";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

export function mapNews(items) {
  return items.map((item) => ({
    id: String(item.id),
    title: item.title || "Untitled",
    body: excerpt(item.summary || item.description),
    subtitle: item.publisher || "Unknown publisher",
    url: item.url || null,
    timestamp: item.publishedAt || item.importedAt || null,
  }));
}

export function mapSocial(items) {
  return items.map((item) => ({
    id: String(item.id),
    title: item.author ? `@${item.author}` : "Social post",
    body: excerpt(item.body),
    subtitle: item.subtitle || "Social",
    url: item.url || null,
    timestamp: item.timestamp || null,
  }));
}

export function mapWeather(items) {
  return items.map((item, idx) => ({
    id: String(item.id || idx),
    title: item.event_name || `${item.wfo || "NWS"} ${item.pil || "Alert"}`,
    body: excerpt(item.raw_text),
    subtitle:
      item.wfo && item.pil ? `${item.wfo} / ${item.pil}` : "Weather feed",
    url: null,
    timestamp: item.issued_at || null,
  }));
}
