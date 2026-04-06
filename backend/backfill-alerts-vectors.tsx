import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

// speed bump to respect Gemini API limits
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function backfillEmbeddings() {
  console.log("Fetching weather alerts from the database...");

  // 1. Fetch all weather alerts
  // Note: Update 'weatherAlert' to exactly match your Prisma model name (e.g., weather_alerts)
  const alerts = await prisma.weatherAlert.findMany();

  if (alerts.length === 0) {
    console.log("No alerts found in the database.");
    return;
  }

  console.log(`Found ${alerts.length} alerts. Starting vector generation...`);

  // loop through each one
  for (const alert of alerts) {
    // combine the event name and summary to provide maximum context
    const textToEmbed = `Event: ${alert.event_name}. Summary: ${alert.summary}`;
    console.log(`Embedding: ${alert.event_name} (ID: ${alert.id})`);

    try {
      // get mathematical vector from Gemini
      const result = await embeddingModel.embedContent({
        content: { parts: [{ text: textToEmbed }] }, // <--- Wrapped the text here!
        outputDimensionality: 768,
      });
      const vector = result.embedding.values;

      // save vector to Supabase
      const vectorString = `[${vector.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE weather_alerts SET embedding = $1::vector WHERE id = $2::uuid`,
        vectorString,
        alert.id,
      );

      console.log(`Successfully saved vector!`);
    } catch (error) {
      console.error(`Failed to embed alert:`, error);
    }

    // wait 2 seconds between requests
    await delay(2000);
  }

  console.log("Weather Alert backfill complete!");
}

backfillEmbeddings()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
