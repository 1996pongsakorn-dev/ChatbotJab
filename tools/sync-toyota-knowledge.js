import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const OUTPUT_PATH = path.join(process.cwd(), "data", "toyota-knowledge.json");

const DEFAULT_URLS = [
  "https://www.toyota.co.th/",
];

const MODEL_NAMES = [
  "Corolla Cross",
  "Yaris",
  "Camry",
  "Fortuner",
  "Hilux",
  "Veloz",
  "Ativ",
];

function parseUrls() {
  const envUrls = process.env.TOYOTA_SOURCE_URLS;
  if (!envUrls) return DEFAULT_URLS;

  return envUrls
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

function normalizeWhitespace(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

function detectModels(text) {
  const lower = text.toLowerCase();
  return MODEL_NAMES.filter((model) => lower.includes(model.toLowerCase()));
}

function extractPriceNote(text) {
  const matches = text.match(/\d{3}[,\d]*\s*(บาท|baht)/gi) || [];
  if (matches.length === 0) return null;

  const unique = [...new Set(matches.map((item) => normalizeWhitespace(item)))].slice(0, 4);
  return `พบข้อมูลราคาในหน้า: ${unique.join(" / ")}`;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ToyotaSalesAgentPOC/1.0 (+knowledge-sync)",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
}

async function main() {
  const urls = parseUrls();
  const modelMap = {};
  const errors = [];
  let existingKnowledge = null;

  try {
    const raw = await fs.readFile(OUTPUT_PATH, "utf-8");
    existingKnowledge = JSON.parse(raw);
  } catch {
    existingKnowledge = null;
  }

  for (const url of urls) {
    try {
      const html = await fetchPage(url);
      const $ = cheerio.load(html);

      const title = normalizeWhitespace($("title").first().text());
      const bodyText = normalizeWhitespace($("body").text()).slice(0, 5000);
      const combined = `${title} ${bodyText}`;

      const models = detectModels(combined);
      const priceNote = extractPriceNote(combined);

      for (const modelName of models) {
        if (!modelMap[modelName]) {
          modelMap[modelName] = {
            summary: `ข้อมูลอ้างอิงจากหน้าเว็บ Toyota: ${title || "Toyota"}`,
            priceNote: priceNote || "โปรดตรวจสอบราคาและรุ่นย่อยล่าสุดกับโชว์รูม",
            highlights: ["อ้างอิงข้อมูลจากเว็บ Toyota"],
            sourceUrl: url,
          };
        }
      }
    } catch (error) {
      errors.push({
        url,
        error: error?.message || String(error),
      });
    }
  }

  const mergedModels = {
    ...(existingKnowledge?.models || {}),
    ...modelMap,
  };

  const knowledge = {
    updatedAt: new Date().toISOString(),
    sourcePolicy: "Only use publicly available pages that your team is allowed to access.",
    syncedUrls: urls,
    errors,
    models: mergedModels,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(knowledge, null, 2), "utf-8");

  const modelCount = Object.keys(modelMap).length;
  const totalCount = Object.keys(mergedModels).length;
  console.log(`Knowledge sync complete. Models detected this run: ${modelCount}, total in store: ${totalCount}`);
  if (modelCount === 0 && totalCount > 0) {
    console.log("No new models detected from current pages, keeping existing knowledge store.");
  }
  if (errors.length > 0) {
    console.log(`Warnings: ${errors.length} page(s) failed.`);
  }
}

main().catch((error) => {
  console.error("Knowledge sync failed:", error);
  process.exit(1);
});
