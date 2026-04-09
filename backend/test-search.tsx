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
  console.log(`\n🔎 Embedding Search Query: "${searchQuery}"...`);

  try {
    // convert user input into vector
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text: searchQuery }] },
      outputDimensionality: 768,
    });

    const queryVector = result.embedding.values;
    const vectorString = `[${queryVector.join(",")}]`;

    console.log(
      "⚡ Vector generated. Searching all 4 databases simultaneously...\n",
    );

    // search ALL tables at the exact same time
    const [weatherMatches, blueskyMatches, tweetMatches, newsMatches] =
      await Promise.all([
        prisma.$queryRawUnsafe<any[]>(
          `SELECT id, event_name, summary, similarity FROM match_weather_alerts($1::vector, 0.3, 5)`,
          vectorString,
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT post_cid, author, raw_text, similarity FROM match_bluesky($1::vector, 0.3, 5)`,
          vectorString,
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT tweet_id, author, raw_text, summary, similarity FROM match_tweets($1::vector, 0.3, 5)`,
          vectorString,
        ),
        prisma.$queryRawUnsafe<any[]>(
          `SELECT id, title, publisher, url, summary, similarity FROM match_news($1::vector, 0.3, 5)`,
          vectorString,
        ),
      ]);

    // print relevant weather alerts
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

    // print relevant bluesky posts
    console.log("\n=========================================");
    console.log("BLUESKY POSTS");
    console.log("=========================================");
    if (blueskyMatches.length === 0) {
      console.log("No relevant Bluesky posts found.");
    } else {
      blueskyMatches.forEach((match, index) => {
        const percent = (match.similarity * 100).toFixed(1);
        console.log(`\n[${index + 1}] Match: ${percent}%`);
        console.log(`Author: @${match.author}`);
        console.log(`Post: ${match.raw_text}`);
      });
    }

    // print relevant tweets
    console.log("\n=========================================");
    console.log("TWEETS");
    console.log("=========================================");
    if (tweetMatches.length === 0) {
      console.log("No relevant tweets found.");
    } else {
      tweetMatches.forEach((match, index) => {
        const percent = (match.similarity * 100).toFixed(1);
        console.log(`\n[${index + 1}] Match: ${percent}%`);
        console.log(`Author: @${match.author}`);
        console.log(`Post: ${match.raw_text}`);
        console.log(`Claude Summary: ${match.summary}`);
      });
    }

    // print relevant news articles
    console.log("\n=========================================");
    console.log("NEWS ARTICLES");
    console.log("=========================================");
    if (newsMatches.length === 0) {
      console.log("No relevant news articles found.");
    } else {
      newsMatches.forEach((match, index) => {
        const percent = (match.similarity * 100).toFixed(1);
        console.log(`\n[${index + 1}] Match: ${percent}%`);
        console.log(`Headline: ${match.title}`);
        console.log(`Publisher: ${match.publisher || "Unknown"}`);
        console.log(`Claude Summary: ${match.summary}`);
      });
    }
  } catch (error) {
    console.error("Search failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// test queries here

searchAll("When will roads be safe to drive on after the snowstorm?");
