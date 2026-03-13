export type SourceId = "weather" | "news" | "social";

export type FeedItem = {
  id: string;
  title: string;
  body: string;
  subtitle: string;
  url: string | null;
  timestamp: string | null;
};

export type OverviewSource = {
  id: SourceId;
  name: string;
  totalCount: number;
  preview: FeedItem[];
};

export type OverviewResponse = {
  sources: OverviewSource[];
};

export type SourceFeedResponse = {
  id: SourceId;
  name: string;
  items: FeedItem[];
};

export type SourceItemDetailResponse = {
  id: string;
  fullBody: string;
};
