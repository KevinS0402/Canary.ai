import Constants from "expo-constants";

import type {
  OverviewResponse,
  SourceFeedResponse,
  SourceId,
  SourceItemDetailResponse,
} from "@/lib/types";

const maybeHostUri =
  Constants.expoConfig?.hostUri ||
  (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } })
    .expoGoConfig?.debuggerHost;
const host = maybeHostUri ? maybeHostUri.split(":")[0] : "localhost";
const fallbackBaseUrl = `http://${host}:3001/api`;

const rawBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || fallbackBaseUrl;
const normalizedBaseUrl = rawBaseUrl.replace(/\/+$/, "");
const API_BASE_URL = normalizedBaseUrl.endsWith("/api")
  ? normalizedBaseUrl
  : `${normalizedBaseUrl}/api`;

function buildQuery(params: Record<string, string | undefined>) {
  const entries = Object.entries(params).filter(
    (pair): pair is [string, string] => pair[1] !== undefined,
  );
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries).toString()}`;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}

export function fetchOverview(
  before?: string | null,
): Promise<OverviewResponse> {
  const qs = buildQuery({ before: before || undefined });
  return request<OverviewResponse>(`/sources/overview${qs}`);
}

export function fetchSourceFeed(
  sourceId: SourceId,
  before?: string | null,
): Promise<SourceFeedResponse> {
  const qs = buildQuery({ before: before || undefined });
  return request<SourceFeedResponse>(`/sources/${sourceId}${qs}`);
}

export function fetchSourceItemDetail(
  sourceId: SourceId,
  itemId: string,
): Promise<SourceItemDetailResponse> {
  return request<SourceItemDetailResponse>(
    `/sources/${sourceId}/${encodeURIComponent(itemId)}`,
  );
}

export function resolveSourceId(sourceId: string): SourceId {
  if (sourceId === "weather" || sourceId === "news" || sourceId === "social") {
    return sourceId;
  }
  return "news";
}

// semantic search fetch
export function fetchSearchResults(query: string): Promise<any> {
  return request<any>(`/search?q=${encodeURIComponent(query)}`);
}
