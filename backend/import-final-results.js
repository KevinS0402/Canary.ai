require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const prisma = new PrismaClient();

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
      if (inQuotes && content[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      field = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function toDate(value) {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

function mapRows(rawRows) {
  if (rawRows.length === 0) return [];

  const [header, ...data] = rawRows;
  const normalizedHeader = header.map((h) => h.trim().toLowerCase());

  const idx = {
    link: normalizedHeader.indexOf("link"),
    headline: normalizedHeader.indexOf("headline"),
    fullContents: normalizedHeader.indexOf("full contents"),
    datePublished: normalizedHeader.indexOf("date published"),
    dateScraped: normalizedHeader.indexOf("date scraped"),
    publisher: normalizedHeader.indexOf("publisher"),
  };

  const required = ["link", "headline", "fullContents", "publisher"];
  for (const key of required) {
    if (idx[key] < 0) {
      throw new Error(`Missing required CSV column: ${key}`);
    }
  }

  return data
    .map((row) => ({
      link: row[idx.link] || "",
      headline: row[idx.headline] || "",
      fullContents: row[idx.fullContents] || "",
      datePublished: idx.datePublished >= 0 ? row[idx.datePublished] || "" : "",
      dateScraped: idx.dateScraped >= 0 ? row[idx.dateScraped] || "" : "",
      publisher: row[idx.publisher] || "",
    }))
    .filter((row) => row.link.trim().length > 0);
}

async function main() {
  const csvPath = path.resolve(process.cwd(), "py_scripts/final_results.csv");
  const raw = await readFile(csvPath, "utf8");
  const parsed = parseCsv(raw);
  const rows = mapRows(parsed);

  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const publishedAt = toDate(row.datePublished) || toDate(row.dateScraped);
    const publisher = row.publisher.trim() || null;
    const description = row.fullContents.trim() || null;
    const title = row.headline.trim() || "Untitled";
    const url = row.link.trim();

    const existing = await prisma.newsArticle.findUnique({ where: { url } });

    await prisma.newsArticle.upsert({
      where: { url },
      create: {
        title,
        url,
        publisher,
        publishedAt,
        description,
        summary: null,
      },
      update: {
        title,
        publisher,
        publishedAt,
        description,
      },
    });

    if (existing) updated++;
    else inserted++;
  }

  console.log(
    `Import complete. Rows processed: ${rows.length}, inserted: ${inserted}, updated: ${updated}`,
  );
}

main()
  .catch((error) => {
    console.error("Failed to import final_results.csv:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
