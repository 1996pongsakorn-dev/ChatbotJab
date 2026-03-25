import { callGemini } from "./models/gemini.js";
import { callClaude } from "./models/claude.js";

export async function callModel(modelKey, payload) {
  if (modelKey === "claude_haiku") {
    return await callClaude(payload);
  }

  // default ใช้ gemini
  return await callGemini(payload);
}