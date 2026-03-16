import { Agent, AtpAgentLoginOpts, CredentialSession } from "@atproto/api";
import { createClient } from "@supabase/supabase-js";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", "backend", ".env") });
const BSKY_PASSWORD: string = process.env.BSKY_PASSWORD || "";
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const account: AtpAgentLoginOpts = {
  identifier: "ca1122.bsky.social",
  password: BSKY_PASSWORD,
};

const session = new CredentialSession(new URL("https://bsky.social"));
await session.login(account);
const agent = new Agent(session);

// Setting up Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ],
});

const QUERIES = [
  "Nashville emergency",
  "Nashville danger",
  "Nashville natural disaster",
  "Nashville road damage",
  "Nashville closure",
  "Nashville storm",
];
const SINCE = "2026-01-22T00:00:00Z";
const UNTIL = "2026-02-02T00:00:00Z";

// Changed this to 2 for free tier testing for Gemini
const LIMIT = 2; // Bluesky allows up to 100

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// AI summarizer function
async function getAiSummary(text: string): Promise<string> {
  if (!text || text.length < 15) return "Post too short to summarize.";

  let retries = 3;
  while (retries > 0) {
    try {
      const prompt = `
        You are an emergency response assistant for a weather app. 
        Read this social media post about a Nashville storm/emergency. 
        Summarize the core threat, damage, or actionable info in exactly 1 short sentence. 
        If it's just irrelevant chatter or opinions, reply with "No actionable emergency info."
        
        Post: "${text}"
      `;
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (err: any) {
      if (err.status === 503 || err?.message?.includes("timed out")) {
        console.warn(
          `Server busy. Retries left: ${retries - 1}. Waiting 10s...`,
        );
        await sleep(10000);
        retries--;
      } else if (err.status === 429) {
        console.error("Daily API Quota Exceeded! Returning fallback text.");
        return "Summary unavailable (Rate Limit).";
      } else {
        console.error("Gemini API error:", err.message);
        return "Summary unavailable.";
      }
    }
  }
  return "Summary unavailable (Timeout).";
}

function normalizeItem(item: any) {
  const post = item.post ?? item;
  const author = item.author ?? post.author ?? {};
  const record = item.record ?? post.record ?? {};
  const uri = post.uri ?? "";
  const cid = post.cid ?? "";
  const cidFromUriMatch = uri ? uri.match(/\/([^\/]+)$/) : null;
  const postId = (cidFromUriMatch ? cidFromUriMatch[1] : "") || cid;
  const createdAt = record.createdAt ?? post.sortAt ?? "";
  const handle = author.handle ?? author.displayName ?? "";
  const text = record.text ?? post.text ?? "";
  const url =
    handle && postId
      ? `https://bsky.app/profile/${handle}/post/${postId}`
      : uri;
  console.log(url);
  return {
    post_cid: cid,
    created_at: createdAt,
    author_id: author.did ?? "",
    author: handle,
    raw_text: text,
    raw_json: JSON.stringify(post),
    url,
  };
}

async function upsertPosts(rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return;
  console.log(`upserting ${rows.length} rows`);
  const { error, data } = await supabase
    .from("bluesky")
    .upsert(rows, { onConflict: "post_cid" });
  if (error) console.error("supabase upsert error:", error);
  else console.log("upsert ok:", Array.isArray(data) ? data.length : data);
}

async function runQuery(q: string) {
  let cursor: string | undefined = undefined;
  let total = 0;
  while (true) {
    try {
      const res = await agent.app.bsky.feed.searchPosts({
        q,
        limit: LIMIT,
        cursor,
        since: SINCE,
        until: UNTIL,
        sort: "latest",
      });
      const body: any = (res as any).data ?? res;
      const posts = body.posts ?? body.data ?? body.results ?? [];
      cursor = body.cursor ?? undefined;
      if (!posts || posts.length === 0) {
        console.log(`query "${q}": no posts returned, stopping`);
        break;
      }
      const rawRows = posts.map(normalizeItem);
      const rowsWithSummaries = [];

      for (const row of rawRows) {
        console.log(`Summarizing post by ${row.author}...`);
        const summary = await getAiSummary(row.raw_text);

        // Attach AI summary to row object
        rowsWithSummaries.push({ ...row, summary });

        // Speed bump (to ensure we stay under 5 requests per min)
        console.log("Waiting 15s to respect rate limits...");
        await sleep(15000);
      }

      await upsertPosts(rowsWithSummaries);
      total += rowsWithSummaries.length;
      console.log(`fetched ${rowsWithSummaries.length} posts; total=${total}`);
      if (!cursor) {
        console.log("no cursor, finished pagination");
        break;
      }
      await sleep(1000); // gentle pause
    } catch (err) {
      console.error("page fetch error:", err);
      await sleep(2000);
    }
  }
  console.log("done");
}

async function main() {
  for (const q of QUERIES) {
    await runQuery(q);
  }
  console.log("done");
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
