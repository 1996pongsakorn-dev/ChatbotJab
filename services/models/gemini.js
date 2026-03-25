import { VertexAI } from "@google-cloud/vertexai";

const projectId =
  process.env.GCP_PROJECT_ID ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  "toyota-ai-sales-agent-poc";

const vertex = new VertexAI({
  project: projectId,
  location: process.env.GCP_LOCATION || "us-central1",
});

export async function callGemini({
  systemPrompt,
  messages,
  generationConfig,
}) {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const model = vertex.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
  });

  const mergedConfig = {
    temperature: 0.5,
    maxOutputTokens: 1500,
    ...generationConfig,
  };

  const result = await model.generateContent({
    contents: messages,
    generationConfig: mergedConfig,
  });

  const candidate = result.response?.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const parts = candidate?.content?.parts || [];
  const text = parts
    .map((part) => part?.text || "")
    .join("")
    .trim();

  if (finishReason && finishReason !== "STOP") {
    console.warn(`[Gemini] finishReason=${finishReason} maxOutputTokens=${mergedConfig.maxOutputTokens} textLen=${text.length}`);
  }

  return text || "ขออภัยค่ะ ระบบขัดข้องเล็กน้อย กรุณาลองใหม่อีกครั้งนะคะ";
}