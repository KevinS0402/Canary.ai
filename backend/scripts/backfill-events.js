import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import prisma from "../prisma/prisma.js";

const BATCH_SIZE = Number(process.env.EVENT_BACKFILL_BATCH_SIZE || 500);
const MATCH_WINDOW_HOURS = Number(process.env.EVENT_MATCH_WINDOW_HOURS || 24);
const LIKELY_ONGOING_AFTER_HOURS = Number(
  process.env.EVENT_LIKELY_ONGOING_AFTER_HOURS || 6,
);
const ENDED_AFTER_HOURS = Number(process.env.EVENT_ENDED_AFTER_HOURS || 24);

const CHECKPOINT_PATH = path.resolve(
  process.cwd(),
  "scripts/.backfill-events-checkpoint.json",
);

const EVENT_KEYWORDS = [
  "warning",
  "watch",
  "advisory",
  "storm",
  "tornado",
  "thunderstorm",
  "flood",
  "hail",
  "wind",
  "snow",
  "ice",
  "heat",
  "cold",
  "hurricane",
  "wildfire",
  "evacuation",
  "incident",
];

const LOCAL_REGION_MATCHERS = [
  { term: "nashville", key: "nashville" },
  { term: "davidson county", key: "davidson_county" },
  { term: "middle tennessee", key: "middle_tennessee" },
  { term: "tennessee", key: "tennessee" },
  { term: "southeast", key: "southeast" },
  { term: "southeastern", key: "southeast" },
  { term: "sumner county", key: "sumner_county" },
  { term: "rutherford county", key: "rutherford_county" },
  { term: "williamson county", key: "williamson_county" },
  { term: "wilson county", key: "wilson_county" },
  { term: "montgomery county", key: "montgomery_county" },
  { term: "cheatham county", key: "cheatham_county" },
  { term: "robertson county", key: "robertson_county" },
  { term: "maury county", key: "maury_county" },
];

function cleanText(value) {
  return (value || "").trim();
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ").slice(0, 120);
}

function pickFirst(...values) {
  return values.find((value) => cleanText(value).length > 0) || "";
}

function hasEventKeyword(text) {
  const lower = text.toLowerCase();
  return EVENT_KEYWORDS.some((term) => lower.includes(term));
}

function getRegionCategory(...sources) {
  const combined = sources
    .map((value) => cleanText(value))
    .join(" ")
    .toLowerCase();
  for (const matcher of LOCAL_REGION_MATCHERS) {
    if (combined.includes(matcher.term)) {
      return {
        locality: "local",
        locationKey: `local_${matcher.key}`,
      };
    }
  }
  return {
    locality: "non_local",
    locationKey: "non_local",
  };
}

function extractLocationFromText(text) {
  const sentence = cleanText(text);
  if (!sentence) return null;

  const countyUpper = sentence.match(/\b([A-Z][A-Z]+)\s+COUNTY\b/);
  if (countyUpper) {
    return `${countyUpper[1].toLowerCase()} county`;
  }

  const phrase = sentence.match(
    /\b(?:in|near|across|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})(?:\s+(?:County|City))?/,
  );
  if (phrase) {
    return normalizeKey(phrase[1]);
  }

  return null;
}

function deriveEventType(text) {
  const lower = text.toLowerCase();
  if (lower.includes("tornado")) return "tornado";
  if (lower.includes("thunderstorm")) return "thunderstorm";
  if (lower.includes("flood")) return "flood";
  if (lower.includes("winter storm")) return "winter_storm";
  if (lower.includes("snow")) return "snow";
  if (lower.includes("ice")) return "ice";
  if (lower.includes("wind")) return "wind";
  if (lower.includes("heat")) return "heat";
  if (lower.includes("cold")) return "cold";
  if (lower.includes("wildfire")) return "wildfire";
  if (lower.includes("evacuation")) return "evacuation";
  if (lower.includes("incident")) return "incident";
  return "weather_general";
}

function statusFromLastSeen(lastSeenTime, now = new Date()) {
  const elapsedMs = now.getTime() - lastSeenTime.getTime();
  const likelyMs = LIKELY_ONGOING_AFTER_HOURS * 60 * 60 * 1000;
  const endedMs = ENDED_AFTER_HOURS * 60 * 60 * 1000;

  if (elapsedMs >= endedMs) return "ended";
  if (elapsedMs >= likelyMs) return "likely_ongoing";
  return "ongoing";
}

function classifyDocument(doc) {
  const text = pickFirst(doc.title, doc.summary, doc.body, doc.rawText);
  const regionCategory = getRegionCategory(
    doc.locationHint,
    doc.title,
    doc.summary,
    doc.body,
    doc.rawText,
  );

  if (doc.sourceType === "weather") {
    return {
      outcome: "event",
      eventType: deriveEventType(pickFirst(doc.eventHint, text)),
      locationKey: regionCategory.locationKey,
      title: pickFirst(doc.eventHint, doc.title, "Weather Event"),
      matchReason: `weather_rule_match_${regionCategory.locality}`,
    };
  }

  if (!hasEventKeyword(text)) {
    return { outcome: "no_event" };
  }

  return {
    outcome: "event",
    eventType: deriveEventType(text),
    locationKey: regionCategory.locationKey,
    title: pickFirst(doc.title, doc.summary, "Weather-Related Event"),
    matchReason: `keyword_location_match_${regionCategory.locality}`,
  };
}

async function readCheckpoint() {
  try {
    const raw = await fs.readFile(CHECKPOINT_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      weatherSkip: Number(parsed.weatherSkip || 0),
      socialTweetSkip: Number(parsed.socialTweetSkip || 0),
      socialBlueskySkip: Number(parsed.socialBlueskySkip || 0),
      newsSkip: Number(parsed.newsSkip || 0),
    };
  } catch {
    return {
      weatherSkip: 0,
      socialTweetSkip: 0,
      socialBlueskySkip: 0,
      newsSkip: 0,
    };
  }
}

async function writeCheckpoint(checkpoint) {
  await fs.writeFile(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
}

async function resolveOrCreateEvent(tx, docTime, classified) {
  const cutoff = new Date(
    docTime.getTime() - MATCH_WINDOW_HOURS * 60 * 60 * 1000,
  );
  const existing = await tx.event.findFirst({
    where: {
      eventType: classified.eventType,
      locationKey: classified.locationKey,
      status: { in: ["ongoing", "likely_ongoing"] },
      lastSeenTime: { gte: cutoff },
    },
    orderBy: [{ lastSeenTime: "desc" }],
  });

  if (existing) {
    const touchedAt =
      docTime.getTime() > existing.lastSeenTime.getTime()
        ? docTime
        : existing.lastSeenTime;
    const status = statusFromLastSeen(touchedAt);
    const updated = await tx.event.update({
      where: { id: existing.id },
      data: {
        lastSeenTime: touchedAt,
        status,
        endedAt: status === "ended" ? touchedAt : null,
      },
    });
    return { event: updated, outcome: "matched_existing" };
  }

  const status = statusFromLastSeen(docTime);
  const created = await tx.event.create({
    data: {
      eventType: classified.eventType,
      locationKey: classified.locationKey,
      title: classified.title,
      status,
      startTime: docTime,
      lastSeenTime: docTime,
      endedAt: status === "ended" ? docTime : null,
    },
  });
  return { event: created, outcome: "create_new" };
}

async function trackDocument(input, metrics) {
  const docTime = input.docTime || new Date();
  const existingLink = await prisma.eventSourceLink.findUnique({
    where: {
      sourceType_sourceItemId: {
        sourceType: input.sourceType,
        sourceItemId: input.sourceItemId,
      },
    },
  });

  if (existingLink) {
    const existingEvent = await prisma.event.findUnique({
      where: { id: existingLink.eventId },
      select: { id: true, lastSeenTime: true },
    });
    if (existingEvent) {
      const touchedAt =
        docTime.getTime() > existingEvent.lastSeenTime.getTime()
          ? docTime
          : existingEvent.lastSeenTime;
      await prisma.event.update({
        where: { id: existingLink.eventId },
        data: {
          lastSeenTime: touchedAt,
          status: statusFromLastSeen(touchedAt),
          endedAt: null,
        },
      });
    }
    metrics.alreadyLinked += 1;
    return;
  }

  const classified = classifyDocument(input);
  if (classified.outcome === "no_event") {
    metrics.noEvent += 1;
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const resolved = await resolveOrCreateEvent(tx, docTime, classified);
    await tx.eventSourceLink.upsert({
      where: {
        sourceType_sourceItemId: {
          sourceType: input.sourceType,
          sourceItemId: input.sourceItemId,
        },
      },
      update: {
        matchReason: classified.matchReason,
      },
      create: {
        eventId: resolved.event.id,
        sourceType: input.sourceType,
        sourceItemId: input.sourceItemId,
        matchReason: classified.matchReason,
      },
    });
    return resolved.outcome;
  });

  if (result === "matched_existing") {
    metrics.matchedExisting += 1;
  } else {
    metrics.createdNew += 1;
  }
}

async function processWeather(checkpoint, metrics) {
  let skip = checkpoint.weatherSkip;

  while (true) {
    const rows = await prisma.weatherAlert.findMany({
      skip,
      take: BATCH_SIZE,
      orderBy: [{ issued_at: "asc" }, { id: "asc" }],
      select: {
        id: true,
        issued_at: true,
        event_name: true,
        summary: true,
        raw_text: true,
        wfo: true,
        pil: true,
      },
    });
    if (!rows.length) break;

    for (const row of rows) {
      try {
        await trackDocument(
          {
            sourceType: "weather",
            sourceItemId: row.id,
            docTime: row.issued_at || new Date(),
            title: row.event_name || null,
            summary: row.summary || null,
            rawText: row.raw_text || null,
            eventHint: row.event_name || null,
            locationHint: `${row.wfo || ""} ${row.pil || ""}`,
          },
          metrics,
        );
      } catch (error) {
        metrics.errors += 1;
        console.error("Weather backfill failed for row:", row.id, error);
      } finally {
        metrics.processed += 1;
      }
    }

    skip += rows.length;
    checkpoint.weatherSkip = skip;
    await writeCheckpoint(checkpoint);
    console.log(`Weather processed: ${skip}`);
  }
}

async function processSocial(checkpoint, metrics) {
  let tweetSkip = checkpoint.socialTweetSkip;

  while (true) {
    const tweets = await prisma.tweet.findMany({
      skip: tweetSkip,
      take: BATCH_SIZE,
      orderBy: [{ created_at: "asc" }, { tweet_id: "asc" }],
      select: {
        tweet_id: true,
        created_at: true,
        summary: true,
        raw_text: true,
        location: true,
      },
    });
    if (!tweets.length) break;

    for (const row of tweets) {
      try {
        await trackDocument(
          {
            sourceType: "social",
            sourceItemId: `tweet-${row.tweet_id.toString()}`,
            docTime: row.created_at || new Date(),
            summary: row.summary || null,
            rawText: row.raw_text || null,
            locationHint: row.location || null,
          },
          metrics,
        );
      } catch (error) {
        metrics.errors += 1;
        console.error(
          "Tweet backfill failed for row:",
          row.tweet_id.toString(),
          error,
        );
      } finally {
        metrics.processed += 1;
      }
    }

    tweetSkip += tweets.length;
    checkpoint.socialTweetSkip = tweetSkip;
    await writeCheckpoint(checkpoint);
    console.log(`Tweets processed: ${tweetSkip}`);
  }

  let blueskySkip = checkpoint.socialBlueskySkip;
  while (true) {
    const rows = await prisma.bluesky.findMany({
      skip: blueskySkip,
      take: BATCH_SIZE,
      orderBy: [{ created_at: "asc" }, { post_cid: "asc" }],
      select: {
        post_cid: true,
        created_at: true,
        summary: true,
        raw_text: true,
      },
    });
    if (!rows.length) break;

    for (const row of rows) {
      try {
        await trackDocument(
          {
            sourceType: "social",
            sourceItemId: `bluesky-${row.post_cid}`,
            docTime: row.created_at || new Date(),
            summary: row.summary || null,
            rawText: row.raw_text || null,
          },
          metrics,
        );
      } catch (error) {
        metrics.errors += 1;
        console.error("Bluesky backfill failed for row:", row.post_cid, error);
      } finally {
        metrics.processed += 1;
      }
    }

    blueskySkip += rows.length;
    checkpoint.socialBlueskySkip = blueskySkip;
    await writeCheckpoint(checkpoint);
    console.log(`Bluesky processed: ${blueskySkip}`);
  }
}

async function processNews(checkpoint, metrics) {
  let skip = checkpoint.newsSkip;

  while (true) {
    const rows = await prisma.newsArticle.findMany({
      skip,
      take: BATCH_SIZE,
      orderBy: [{ publishedAt: "asc" }, { importedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        title: true,
        summary: true,
        description: true,
        publishedAt: true,
        importedAt: true,
      },
    });
    if (!rows.length) break;

    for (const row of rows) {
      try {
        await trackDocument(
          {
            sourceType: "news",
            sourceItemId: String(row.id),
            docTime: row.publishedAt || row.importedAt || new Date(),
            title: row.title || null,
            summary: row.summary || null,
            body: row.description || null,
          },
          metrics,
        );
      } catch (error) {
        metrics.errors += 1;
        console.error("News backfill failed for row:", row.id, error);
      } finally {
        metrics.processed += 1;
      }
    }

    skip += rows.length;
    checkpoint.newsSkip = skip;
    await writeCheckpoint(checkpoint);
    console.log(`News processed: ${skip}`);
  }
}

async function normalizeEventStatuses() {
  let skip = 0;
  while (true) {
    const rows = await prisma.event.findMany({
      skip,
      take: BATCH_SIZE,
      orderBy: [{ lastSeenTime: "asc" }, { id: "asc" }],
      select: { id: true, lastSeenTime: true },
    });
    if (!rows.length) break;

    for (const row of rows) {
      const status = statusFromLastSeen(row.lastSeenTime);
      await prisma.event.update({
        where: { id: row.id },
        data: {
          status,
          endedAt: status === "ended" ? row.lastSeenTime : null,
        },
      });
    }
    skip += rows.length;
  }
}

async function main() {
  const checkpoint = await readCheckpoint();
  const metrics = {
    processed: 0,
    matchedExisting: 0,
    createdNew: 0,
    noEvent: 0,
    alreadyLinked: 0,
    errors: 0,
  };

  console.log("Starting event backfill with checkpoint:", checkpoint);
  await processWeather(checkpoint, metrics);
  await processSocial(checkpoint, metrics);
  await processNews(checkpoint, metrics);
  await normalizeEventStatuses();

  console.log("Backfill complete:", metrics);
}

main()
  .catch((error) => {
    console.error("Event backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
