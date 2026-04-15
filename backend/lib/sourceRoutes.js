import express from "express";
import {
  fetchItemFullBody,
  fetchTopNews,
  fetchTopSocial,
  fetchTopWeather,
  safeFetch,
} from "./fetchers.js";
import {
  mapNews,
  mapSocial,
  mapWeather,
  normalizeSourceId,
} from "./normalize.js";

const router = express.Router();

function parseBeforeDate(raw) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T23:59:59.999Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseBeforeDateNaive(raw) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return new Date(`${raw}T23:59:59.999`);
}

router.get("/overview", async (req, res) => {
  try {
    const before = parseBeforeDate(req.query.before);
    const beforeNaive = parseBeforeDateNaive(req.query.before);
    const [weatherRows, newsRows, socialRows] = await Promise.all([
      safeFetch(() => fetchTopWeather(5, before), "weather rows"),
      safeFetch(() => fetchTopNews(5, beforeNaive), "news rows"),
      safeFetch(() => fetchTopSocial(5, before), "social rows"),
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
    console.error("Failed /overview:", error);
    res.status(500).json({ error: "Unable to load overview data." });
  }
});

router.get("/:sourceId", async (req, res) => {
  const sourceId = normalizeSourceId(req.params.sourceId);
  const before = parseBeforeDate(req.query.before);
  const beforeNaive = parseBeforeDateNaive(req.query.before);

  try {
    if (sourceId === "weather") {
      const weatherRows = await safeFetch(
        () => fetchTopWeather(5, before),
        "weather rows",
      );
      return res.json({
        id: "weather",
        name: "Weather Channels",
        items: mapWeather(weatherRows),
      });
    }

    if (sourceId === "news") {
      const newsRows = await safeFetch(
        () => fetchTopNews(5, beforeNaive),
        "news rows",
      );
      return res.json({
        id: "news",
        name: "News",
        items: mapNews(newsRows),
      });
    }

    if (sourceId === "social") {
      const socialRows = await safeFetch(
        () => fetchTopSocial(5, before),
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

router.get("/:sourceId/:itemId", async (req, res) => {
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

export default router;
