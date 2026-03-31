import express from "express";
import { runAgent } from "../services/orchestrator.js";

const router = express.Router();

router.post("/", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const { message, sessionId, modelKey } = req.body ?? {};
    const normalizedMessage = typeof message === "string" ? message.trim() : "";
    const normalizedSessionId = typeof sessionId === "string" ? sessionId.trim() : "";

    if (!normalizedMessage || !normalizedSessionId) {
      return res.status(400).json({ ok: false, error: "message and sessionId are required" });
    }

    if (normalizedMessage.length > 500) {
      return res.status(400).json({ ok: false, error: "message must not exceed 500 characters" });
    }

    if (normalizedSessionId.length > 100) {
      return res.status(400).json({ ok: false, error: "sessionId must not exceed 100 characters" });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(normalizedSessionId)) {
      return res.status(400).json({ ok: false, error: "sessionId may contain only letters, numbers, _ and -" });
    }

    const response = await runAgent({
      userId: normalizedSessionId,
      userMessage: normalizedMessage,
      modelKey,
    });

    res.json({ ok: true, ...response });
  } catch (error) {
    console.error("[chat route error]", error);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: error.message || "Internal Server Error" });
    }
  }
});

export default router;