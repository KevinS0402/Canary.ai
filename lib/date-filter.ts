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
  timeZone: "UTC",
};

export function formatTimestamp(timestamp: string | null): string {
  const ms = parseTimestamp(timestamp);
  if (ms === null) return "";
  return new Date(ms).toLocaleDateString("en-US", DATE_FORMAT_OPTIONS);
}
