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

async function backfillBlueskyEmbeddings() {
  console.log("Fetching Bluesky posts from the database...");

  // fetch bluesky posts
  const posts = await prisma.bluesky.findMany();

  if (posts.length === 0) {
    console.log("No Bluesky posts found in the database.");
    return;
  }

  console.log(`Found ${posts.length} posts. Starting vector generation...`);

  // loop through each post
  for (const post of posts) {
    // combine the author and the raw text to provide maximum context
    const textToEmbed = `Author: ${post.author}. Post: ${post.raw_text}`;
    console.log(`Embedding post by ${post.author} (CID: ${post.post_cid})`);

    try {
      // Get 768-dimension mathematical vector from Gemini
      const result = await embeddingModel.embedContent({
        content: { parts: [{ text: textToEmbed }] },
        outputDimensionality: 768,
      });
      const vector = result.embedding.values;

      // Save vector to Supabase
      const vectorString = `[${vector.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE bluesky SET embedding = $1::vector WHERE post_cid = $2`,
        vectorString,
        post.post_cid,
      );

      console.log(`Successfully saved vector!`);
    } catch (error) {
      console.error(`Failed to embed post:`, error);
    }

    // Wait 2 seconds between requests
    await delay(2000);
  }

  console.log("🎉 Bluesky backfill complete!");
}

backfillBlueskyEmbeddings()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
