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

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}

export function fetchOverview(): Promise<OverviewResponse> {
  return request<OverviewResponse>("/sources/overview");
}

export function fetchSourceFeed(
  sourceId: SourceId,
): Promise<SourceFeedResponse> {
  return request<SourceFeedResponse>(`/sources/${sourceId}`);
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
