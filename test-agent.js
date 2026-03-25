import { runAgent } from "./services/orchestrator.js";

async function test() {
  const reply = await runAgent({
    userId: "test123",
    userMessage: "งบประมาณ 900000 บาท",
    modelKey: "gemini_flash",
  });

  console.log("Bot:", reply.reply);
  console.log("Meta:", {
    stage: reply.stage,
    leadScore: reply.leadScore,
    modelKey: reply.modelKey,
  });
}

test();