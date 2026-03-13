import { Agent, AtpAgentLoginOpts, CredentialSession } from "@atproto/api";
import { createClient } from "@supabase/supabase-js";
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
const LIMIT = 100; // Bluesky allows up to 100

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      const rows = posts.map(normalizeItem);
      await upsertPosts(rows);
      total += rows.length;
      console.log(`fetched ${rows.length} posts; total=${total}`);
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
