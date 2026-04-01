require("dotenv/config");
const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);

function excerpt(text, max = 160) {
  if (!text) return "No preview available.";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function normalizeSourceId(sourceId) {
  if (sourceId === "weather-channels") return "weather";
  if (sourceId === "social-media") return "social";
  return sourceId;
}

async function safeFetch(fetcher, label) {
  try {
    return await fetcher();
  } catch (error) {
    console.error(`Failed to fetch ${label}:`, error);
    return [];
  }
}

async function fetchTopNews(limit = 5) {
  return prisma.newsArticle.findMany({
    take: limit,
    orderBy: [{ publishedAt: "desc" }, { importedAt: "desc" }],
  });
}

async function fetchTopSocial(limit = 5) {
  const tweets = await prisma.tweet.findMany({
    take: limit,
    orderBy: [{ created_at: "desc" }],
  });

  const bluesky = await prisma.bluesky.findMany({
    take: limit,
    orderBy: [{ created_at: "desc" }],
  });

  const combined = [
    ...tweets.map((row) => ({
      kind: "tweet",
      id: `tweet-${row.tweet_id}`,
      author: row.author || row.author_id || "social post",
      body: row.summary || row.raw_text || "",
      subtitle: row.location || "X",
      url: row.url || null,
      timestamp: row.created_at || null,
    })),
    ...bluesky.map((row) => ({
      kind: "bluesky",
      id: `bluesky-${row.post_cid}`,
      author: row.author || row.author_id || "social post",
      body: row.summary || row.raw_text || "",
      subtitle: "Bluesky",
      url: row.url || null,
      timestamp: row.created_at || null,
    })),
  ];

  combined.sort((a, b) => {
    const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return bTime - aTime;
  });

  return combined.slice(0, limit);
}

async function fetchTopWeather(limit = 5) {
  return prisma.weatherAlert.findMany({
    take: limit,
    orderBy: [{ issued_at: "desc" }],
  });
}

function mapNews(items) {
  return items.map((item) => ({
    id: String(item.id),
    title: item.title || "Untitled",
    body: excerpt(item.summary || item.description),
    subtitle: item.publisher || "Unknown publisher",
    url: item.url || null,
    timestamp: item.publishedAt || item.importedAt || null,
  }));
}

function mapSocial(items) {
  return items.map((item) => ({
    id: String(item.id),
    title: item.author ? `@${item.author}` : "Social post",
    body: excerpt(item.body),
    subtitle: item.subtitle || "Social",
    url: item.url || null,
    timestamp: item.timestamp || null,
  }));
}

function mapWeather(items) {
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

async function fetchItemFullBody(sourceId, itemId) {
  if (sourceId === "news") {
    const numericId = Number(itemId);
    if (!Number.isInteger(numericId)) return null;

    const row = await prisma.newsArticle.findUnique({
      where: { id: numericId },
      select: { id: true, summary: true, description: true },
    });
    if (!row) return null;

    return {
      id: String(row.id),
      fullBody: row.summary || row.description || "No preview available.",
    };
  }

  if (sourceId === "weather") {
    const row = await prisma.weatherAlert.findUnique({
      where: { id: itemId },
      select: { id: true, raw_text: true },
    });
    if (!row) return null;

    return {
      id: String(row.id),
      fullBody: row.raw_text || "No preview available.",
    };
  }

  if (sourceId === "social") {
    if (itemId.startsWith("tweet-")) {
      const rawId = itemId.slice("tweet-".length);
      if (!rawId) return null;

      const row = await prisma.tweet.findUnique({
        where: { tweet_id: BigInt(rawId) },
        select: { tweet_id: true, summary: true, raw_text: true },
      });
      if (!row) return null;

      return {
        id: `tweet-${row.tweet_id.toString()}`,
        fullBody: row.summary || row.raw_text || "No preview available.",
      };
    }

    if (itemId.startsWith("bluesky-")) {
      const postCid = itemId.slice("bluesky-".length);
      if (!postCid) return null;

      const row = await prisma.bluesky.findUnique({
        where: { post_cid: postCid },
        select: { post_cid: true, summary: true, raw_text: true },
      });
      if (!row) return null;

      return {
        id: `bluesky-${row.post_cid}`,
        fullBody: row.summary || row.raw_text || "No preview available.",
      };
    }
  }

  return null;
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/overview", async (_req, res) => {
  try {
    const [weatherRows, newsRows, socialRows] = await Promise.all([
      safeFetch(() => fetchTopWeather(5), "weather rows"),
      safeFetch(() => fetchTopNews(5), "news rows"),
      safeFetch(() => fetchTopSocial(5), "social rows"),
    ]);

    const weatherItems = mapWeather(weatherRows);
    const newsItems = mapNews(newsRows);
    const socialItems = mapSocial(socialRows);

    res.json({
      sources: [
        {
          id: "weather",
          name: "Weather Channels",
          totalCount: weatherItems.length,
          preview: weatherItems.slice(0, 2),
        },
        {
          id: "news",
          name: "News",
          totalCount: newsItems.length,
          preview: newsItems.slice(0, 2),
        },
        {
          id: "social",
          name: "Social Media",
          totalCount: socialItems.length,
          preview: socialItems.slice(0, 2),
        },
      ],
    });
  } catch (error) {
    console.error("Failed /api/overview:", error);
    res.status(500).json({ error: "Unable to load overview data." });
  }
});

app.get("/api/sources/:sourceId", async (req, res) => {
  const sourceId = normalizeSourceId(req.params.sourceId);

  try {
    if (sourceId === "weather") {
      const weatherRows = await safeFetch(
        () => fetchTopWeather(5),
        "weather rows",
      );
      return res.json({
        id: "weather",
        name: "Weather Channels",
        items: mapWeather(weatherRows),
      });
    }

    if (sourceId === "news") {
      const newsRows = await safeFetch(() => fetchTopNews(5), "news rows");
      return res.json({
        id: "news",
        name: "News",
        items: mapNews(newsRows),
      });
    }

    if (sourceId === "social") {
      const socialRows = await safeFetch(
        () => fetchTopSocial(5),
        "social rows",
      );
      return res.json({
        id: "social",
        name: "Social Media",
        items: mapSocial(socialRows),
      });
    }

    return res.status(404).json({ error: "Unknown source." });
  } catch (error) {
    console.error("Failed /api/sources:", error);
    return res.status(500).json({ error: "Unable to load source feed." });
  }
});

app.get("/api/sources/:sourceId/:itemId", async (req, res) => {
  const sourceId = normalizeSourceId(req.params.sourceId);
  const itemId = decodeURIComponent(req.params.itemId || "");

  if (!itemId) {
    return res.status(400).json({ error: "Missing item id." });
  }

  try {
    const item = await fetchItemFullBody(sourceId, itemId);
    if (!item) {
      return res.status(404).json({ error: "Item not found." });
    }

    return res.json(item);
  } catch (error) {
    console.error("Failed /api/sources/:sourceId/:itemId:", error);
    return res.status(500).json({ error: "Unable to load full item content." });
  }
});

app.listen(PORT, () => {
  console.log(`Canary backend API listening on http://localhost:${PORT}`);
});
