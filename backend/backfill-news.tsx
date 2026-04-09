import { PrismaClient } from "@prisma/client";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function backfillNews() {
  console.log(" Fetching news articles from the database...");

  // only fetch articles that haven't been summarized yet
  const articles = await prisma.newsArticle.findMany({
    where: { summary: null },
  });

  if (articles.length === 0) {
    console.log("No un-processed articles found in the database!");
    return;
  }

  console.log(
    `Found ${articles.length} articles. Starting Claude + Gemini pipeline...`,
  );

  for (const article of articles) {
    console.log(`\nProcessing Article: "${article.title}"`);

    try {
      // claude summarization
      const textToSummarize = `Title: ${article.title}\nPublisher: ${article.publisher || "Unknown"}\nDescription: ${article.description || ""}`;

      const claudeResponse = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 150,
        system:
          "You are an emergency weather assistant. Summarize the following news article snippet into a clean, professional, single-sentence summary focusing on the core facts.",
        messages: [{ role: "user", content: textToSummarize }],
      });

      const summary =
        claudeResponse.content[0].type === "text"
          ? claudeResponse.content[0].text
          : "No summary generated.";
      console.log(`↳ Summary: ${summary}`);

      // gemini embedding
      const textToEmbed = `Headline: ${article.title}. Summary: ${summary}`;

      const geminiResult = await embeddingModel.embedContent({
        content: { parts: [{ text: textToEmbed }] },
        outputDimensionality: 768,
      });

      const vector = geminiResult.embedding.values;
      const vectorString = `[${vector.join(",")}]`;

      // saving to Supabase
      await prisma.$executeRawUnsafe(
        `UPDATE "NewsArticle" SET summary = $1, embedding = $2::vector WHERE id = $3`,
        summary,
        vectorString,
        article.id,
      );

      console.log(`Successfully saved summary and vector!`);
    } catch (error) {
      console.error(`Failed to process article:`, error);
    }

    // Wait 2 seconds
    await delay(2000);
  }

  console.log("\n News backfill complete!");
}

backfillNews()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
