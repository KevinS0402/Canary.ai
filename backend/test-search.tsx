import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

async function searchAlerts(searchQuery: string) {
  console.log(`\nSearching for: "${searchQuery}"...`);

  try {
    // 1. Convert the user's search query into a vector
    // CRITICAL: We must shrink it to 768 dimensions so it matches the database!
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text: searchQuery }] },
      outputDimensionality: 768,
    });

    const queryVector = result.embedding.values;
    const vectorString = `[${queryVector.join(",")}]`;

    // 2. Call the Supabase match function using Prisma's raw query
    // Parameters: Vector, Match Threshold (e.g., 0.3 = 30% match), Limit (Top 3)
    const matches: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, event_name, summary, similarity FROM match_weather_alerts($1::vector, 0.3, 3)`,
      vectorString,
    );

    // 3. Print the results
    if (matches.length === 0) {
      console.log("No relevant alerts found.");
    } else {
      matches.forEach((match, index) => {
        // Convert the similarity score to a nice percentage
        const percent = (match.similarity * 100).toFixed(1);
        console.log(`\n[${index + 1}] Match: ${percent}%`);
        console.log(`Event: ${match.event_name}`);
        console.log(`Summary: ${match.summary}`);
      });
    }
  } catch (error) {
    console.error("Search failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// test queries here
// (e.g., "power outage" should match an alert about "loss of electricity" or "blackouts")
searchAlerts("When will the roads be safe to drive on?");
