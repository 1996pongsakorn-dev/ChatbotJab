import { VertexAI } from "@google-cloud/vertexai";
import { callGemini } from "./gemini.js";

const projectId =
  process.env.GCP_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "toyota-ai-sales-agent-poc";

const vertex = new VertexAI({
  project: projectId,
  location: process.env.GCP_LOCATION || "us-central1",
});

export async function callClaude({
  systemPrompt,
  messages,
  generationConfig,
}) {
  const configuredModel = process.env.CLAUDE_MODEL || "claude-3-haiku@20240307";
  const location = process.env.GCP_LOCATION || "us-central1";
  const modelName = configuredModel.startsWith("projects/")
    ? configuredModel
    : `projects/${projectId}/locations/${location}/publishers/anthropic/models/${configuredModel}`;

  try {
    const model = vertex.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent({
      contents: messages,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 300,
        ...generationConfig,
      },
    });

    const parts = result.response?.candidates?.[0]?.content?.parts || [];
    const text = parts
      .map((part) => part?.text || "")
      .join("")
      .trim();

    return text || "ขออภัยค่ะ ระบบขัดข้องเล็กน้อย กรุณาลองใหม่อีกครั้งนะคะ";
  } catch (error) {
    console.error("Claude adapter error:", error?.message || error);
    return await callGemini({
      systemPrompt,
      messages,
      generationConfig,
    });
  }
}