import type { FeedItem } from "@/lib/types";

function toCutoffEndOfDay(date: Date) {
  const cutoff = new Date(date);
  cutoff.setHours(23, 59, 59, 999);
  return cutoff.getTime();
}

function parseTimestamp(timestamp: string | null) {
  if (!timestamp) {
    return null;
  }

  const parsed = new Date(timestamp).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

export function formatTimestamp(timestamp: string | null): string {
  const ms = parseTimestamp(timestamp);
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("en-US", DATE_FORMAT_OPTIONS);
}

export function filterFeedItemsByCutoffDate(
  items: FeedItem[],
  selectedDate: Date | null,
) {
  if (!selectedDate) {
    return items;
  }

  const cutoffTime = toCutoffEndOfDay(selectedDate);

  return items.filter((item) => {
    const itemTime = parseTimestamp(item.timestamp);
    return itemTime !== null && itemTime <= cutoffTime;
  });
}
