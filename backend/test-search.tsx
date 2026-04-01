import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

async function searchAll(searchQuery: string) {
  console.log(`\nEmbedding Search Query: "${searchQuery}"...`);

  try {
    // convert the user's search query into a vector
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text: searchQuery }] },
      outputDimensionality: 768,
    });

    const queryVector = result.embedding.values;
    const vectorString = `[${queryVector.join(",")}]`;

    console.log("Vector generated. Searching databases...\n");

    // search weather alerts & bluesky posts
    const [weatherMatches, blueskyMatches] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(
        `SELECT id, event_name, summary, similarity FROM match_weather_alerts($1::vector, 0.3, 5)`,
        vectorString,
      ),
      prisma.$queryRawUnsafe<any[]>(
        `SELECT post_cid, author, raw_text, similarity FROM match_bluesky($1::vector, 0.3, 5)`,
        vectorString,
      ),
    ]);

    // print weather alerts
    console.log("=========================================");
    console.log("WEATHER ALERTS");
    console.log("=========================================");
    if (weatherMatches.length === 0) {
      console.log("No relevant weather alerts found.");
    } else {
      weatherMatches.forEach((match, index) => {
        const percent = (match.similarity * 100).toFixed(1);
        console.log(`\n[${index + 1}] Match: ${percent}%`);
        console.log(`Event: ${match.event_name}`);
        console.log(`Summary: ${match.summary}`);
      });
    }

    // print bluesky posts
    console.log("\n=========================================");
    console.log("BLUESKY POSTS");
    console.log("=========================================");
    if (blueskyMatches.length === 0) {
      console.log("No relevant social posts found.");
    } else {
      blueskyMatches.forEach((match, index) => {
        const percent = (match.similarity * 100).toFixed(1);
        console.log(`\n[${index + 1}] Match: ${percent}%`);
        console.log(`Author: @${match.author}`);
        console.log(`Post: ${match.raw_text}`);
      });
    }
  } catch (error) {
    console.error("Search failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// use test queries here!

// try searching for a concept like "loss of electricity" or "safe to drive"
searchAll("When will roads be safe to drive on after the snowstorm?");
