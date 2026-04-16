import prisma from "../prisma/prisma.js";

export async function safeFetch(fetcher, label) {
  try {
    return await fetcher();
  } catch (error) {
    console.error(`Failed to fetch ${label}:`, error);
    return [];
  }
}

export async function fetchTopNews(limit = 5, beforeDate = null) {
  const where = beforeDate
    ? { publishedAt: { lte: new Date(`${beforeDate}T23:59:59.999Z`) } }
    : {};
  return prisma.newsArticle.findMany({
    where,
    take: limit,
    orderBy: [{ publishedAt: "desc" }, { importedAt: "desc" }],
  });
}

export async function fetchTopSocial(limit = 5, beforeDate = null) {
  const cutoff = beforeDate ? new Date(`${beforeDate}T23:59:59.999Z`) : null;
  const tweetWhere = cutoff ? { created_at: { lte: cutoff } } : {};
  const blueskyWhere = cutoff
    ? { OR: [{ created_at: { lte: cutoff } }, { created_at: null }] }
    : {};

  const tweets = await prisma.tweet.findMany({
    where: tweetWhere,
    take: limit,
    orderBy: [{ created_at: "desc" }],
  });

  const bluesky = await prisma.bluesky.findMany({
    where: blueskyWhere,
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

export async function fetchTopWeather(limit = 5, beforeDate = null) {
  const cutoff = beforeDate ? new Date(`${beforeDate}T23:59:59.999Z`) : null;
  const where = cutoff
    ? { OR: [{ issued_at: { lte: cutoff } }, { issued_at: null }] }
    : {};
  return prisma.weatherAlert.findMany({
    where,
    take: limit,
    orderBy: [{ issued_at: "desc" }],
  });
}

export async function fetchItemFullBody(sourceId, itemId) {
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
