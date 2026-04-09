import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();

// initialize both AI clients (Claude for summaries, Gemini for embedding)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

// speed bump to respect API rate limits
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function backfillTweets() {
  console.log("Fetching tweets from the database...");

  // Only fetch tweets that haven't been summarized yet
  const tweets = await prisma.tweet.findMany({
    where: { summary: null },
  });

  if (tweets.length === 0) {
    console.log("No un-processed tweets found in the database!");
    return;
  }

  console.log(
    `Found ${tweets.length} tweets. Starting Claude + Gemini pipeline...`,
  );

  for (const tweet of tweets) {
    console.log(`\nProcessing Tweet ID: ${tweet.tweet_id} by @${tweet.author}`);

    try {
      // part 1 - summarize with Claude
      const claudeResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 150,
        system:
          "You are an emergency weather assistant. Summarize the following social media post into a clean, professional, single-sentence summary. Ignore hashtags, URLs, and slang.",
        messages: [{ role: "user", content: tweet.raw_text || "" }],
      });

      // extract text from Claude's response
      const summary =
        claudeResponse.content[0].type === "text"
          ? claudeResponse.content[0].text
          : "No summary generated.";
      console.log(`↳ Summary: ${summary}`);

      // part 2 - vector embedding w/ Gemini
      const textToEmbed = `Author: ${tweet.author}. Summary: ${summary}`;

      const geminiResult = await embeddingModel.embedContent({
        content: { parts: [{ text: textToEmbed }] },
        outputDimensionality: 768,
      });

      const vector = geminiResult.embedding.values;
      const vectorString = `[${vector.join(",")}]`;

      // part 3 - save both results to database
      await prisma.$executeRawUnsafe(
        `UPDATE tweets SET summary = $1, embedding = $2::vector WHERE tweet_id = $3`,
        summary,
        vectorString,
        tweet.tweet_id,
      );

      console.log(`Successfully saved summary and vector!`);
    } catch (error) {
      console.error(`Failed to process tweet:`, error);
    }

    // wait 2 seconds to avoid hitting rate limits on both APIs
    await delay(2000);
  }

  console.log("\nTweet backfill complete!");
}

backfillTweets()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
