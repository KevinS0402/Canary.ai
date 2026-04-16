import cors from "cors";
import "dotenv/config";
import express from "express";
import sourceRoutes from "./lib/sourceRoutes.js";
import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();

app.use(cors());
app.use(express.json());

BigInt.prototype.toJSON = function () {
  return this.toString();
};

const PORT = Number(process.env.PORT || 3001);

const prisma = new PrismaClient();

// initializing gemini embedding
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/sources", sourceRoutes);

// semantic search endpoint
app.get("/api/search", async (req, res) => {
  const searchQuery = req.query.q;

  if (!searchQuery) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  try {
    console.log(`\n [API] Searching for: "${searchQuery}"...`);

    // convert user's search query into a vector
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text: searchQuery }] },
      outputDimensionality: 768,
    });

    const vectorString = `[${result.embedding.values.join(",")}]`;

    // query all 4 databases simultaneously
    const [weather, bluesky, tweets, news] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT id, event_name, summary, similarity FROM match_weather_alerts($1::vector, 0.3, 5)`,
        vectorString,
      ),
      prisma.$queryRawUnsafe(
        `SELECT post_cid, author, raw_text, similarity FROM match_bluesky($1::vector, 0.3, 5)`,
        vectorString,
      ),
      prisma.$queryRawUnsafe(
        `SELECT tweet_id, author, raw_text, summary, similarity FROM match_tweets($1::vector, 0.3, 5)`,
        vectorString,
      ),
      prisma.$queryRawUnsafe(
        `SELECT id, title, publisher, url, summary, similarity FROM match_news($1::vector, 0.3, 5)`,
        vectorString,
      ),
    ]);

    console.log(" Search complete! Sending results to frontend.");

    // sending results back to the mobile app
    res.json({ weather, bluesky, tweets, news });
  } catch (error) {
    console.error("Search API Error:", error);
    res.status(500).json({ error: "Internal server error during search" });
  }
});

app.listen(PORT, () => {
  console.log(`Canary backend API listening on http://localhost:${PORT}`);
});
