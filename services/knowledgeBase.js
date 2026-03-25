import fs from "node:fs";
import path from "node:path";

const KNOWLEDGE_PATH = path.join(process.cwd(), "data", "toyota-knowledge.json");

let cache = {
  mtimeMs: 0,
  data: null,
};

function normalizeModelName(modelName) {
  if (!modelName) return null;

  const normalized = modelName.toLowerCase();

  if (normalized.includes("corolla cross")) return "Corolla Cross";
  if (normalized.includes("fortuner")) return "Fortuner";
  if (normalized.includes("hilux")) return "Hilux";
  if (normalized.includes("veloz")) return "Veloz";
  if (normalized.includes("camry")) return "Camry";
  if (normalized.includes("ativ")) return "Ativ";
  if (normalized.includes("yaris")) return "Yaris";

  return modelName;
}

function loadKnowledge() {
  try {
    const stat = fs.statSync(KNOWLEDGE_PATH);

    if (!cache.data || cache.mtimeMs !== stat.mtimeMs) {
      const raw = fs.readFileSync(KNOWLEDGE_PATH, "utf-8");
      cache = {
        mtimeMs: stat.mtimeMs,
        data: JSON.parse(raw),
      };
    }

    return cache.data;
  } catch {
    return null;
  }
}

export function getModelKnowledge(modelName) {
  const kb = loadKnowledge();
  if (!kb?.models) return null;

  const key = normalizeModelName(modelName);
  return kb.models[key] || null;
}
