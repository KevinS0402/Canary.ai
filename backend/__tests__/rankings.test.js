import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error(
    "Missing GEMINI_API_KEY. Set it in ../.env or in the environment.",
  );
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-001",
});

const QUERY =
  "Emergency assistance and help, nearest shelters, food distribution points, medical services, evacuation routes, closures, danger, caution, outages, info and latest official updates";

async function getQuery(searchQuery) {
  console.log(`\nEmbedding Search Query: "${searchQuery}"...`);

  try {
    // convert the user's search query into a vector
    const result = await embeddingModel.embedContent({
      content: { parts: [{ text: searchQuery }] },
      outputDimensionality: 768,
    });

    const queryVector = result.embedding.values;
    // const vectorString = `[${queryVector.join(",")}]`;
    return queryVector;
  } catch (error) {
    console.error("Search failed:", error);
  }
}

// human rankings are formattd "id rank\n"
function readRankingfromFile(filePath) {
  const text = fs.readFileSync(
    path.resolve(__dirname, "fixtures", filePath),
    "utf8",
  );

  return readRankingfromString(text);
}

// get ranking using the object inputs
function getPredictedRanking(filePath, queryVec) {
  // helper math
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  const norm = (a) => Math.sqrt(dot(a, a));
  const cosine = (a, b) => {
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return 0;
    return dot(a, b) / (na * nb);
  };

  const fullPath = path.resolve(__dirname, "fixtures", filePath);
  const raw = fs.readFileSync(fullPath, "utf8");

  let items;
  try {
    items = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse JSON fixture ${filePath}: ${err}`);
  }

  const scored = [];
  for (const item of items) {
    const id = String(item.id);
    const emb = item.embedding;

    if (!Array.isArray(emb) || emb.length === 0 || emb === null) {
      // missing embedding: deterministic fallback — rank lowest for now
      scored.push({ id, score: -Infinity });
      continue;
    }

    if (queryVec) {
      scored.push({ id: id, score: cosine(emb, queryVec) });
    } else {
      // no query provided: fallback - use norm as proxy (deterministic)
      scored.push({ id: id, score: norm(emb) });
    }
  }

  // sort descending by score (higher = more relevant)
  scored.sort((a, b) => b.score - a.score);

  const map = Object.create(null);
  for (let i = 0; i < scored.length; i++) {
    map[scored[i].id] = i + 1; // 1 = top rank
  }

  return map;
}

// expect human rankings to be ordered
function readRankingfromString(text) {
  const map = Object.create(null);
  let i = 1;
  for (const rawLine of text.split(/\r?\n/)) {
    const id = rawLine.trim();
    if (!id) continue;
    map[id] = i;
    i += 1;
  }

  return map;
}

function computeSpearmanRho(humanRanks, predictedRanks) {
  const humanIds = new Set(Object.keys(humanRanks));
  const predIds = new Set(Object.keys(predictedRanks));
  const intersection = [...humanIds].filter((id) => predIds.has(id));

  const n = intersection.length;
  if (n < 2) return { rho: null, n, sumD2: 0 };

  let sumD2 = 0;
  for (const id of intersection) {
    const r1 = Number(humanRanks[id]);
    const r2 = Number(predictedRanks[id]);
    const d = r1 - r2;
    sumD2 += d * d;
  }

  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
  return { rho, n, sumD2 };
}

function buildCases() {
  const cases = [
    "news_test1",
    "news_test2",
    "bluesky_test1",
    "bluesky_test2",
    "twitter_test1",
    "twitter_test2",
    "blueskytwitter_test1",
  ];

  return cases.map((base) => {
    const humanFile = path.join("rankings_solutions", `${base}.sol.txt`);
    const predFile = path.join("rankings_inputs", `${base}.json`);
    const expectedN = 5;
    const expectedRho = 1.0;
    return { name: base, humanFile, predFile, expectedN, expectedRho };
  });
}

let queryVec;
describe("Spearman Ranking Tests", () => {
  const cases = buildCases();
  beforeAll(async () => {
    queryVec = await getQuery(QUERY);
  });
  cases.forEach(({ name, humanFile, predFile, expectedN, expectedRho }) => {
    test(name, () => {
      const human = readRankingfromFile(humanFile);
      const pred = getPredictedRanking(predFile, queryVec);
      const { rho, n } = computeSpearmanRho(human, pred);
      expect(n).toBe(expectedN);
      expect(rho).toBeCloseTo(expectedRho, 6);
    });
  });
});
