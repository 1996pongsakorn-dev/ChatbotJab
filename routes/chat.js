import express from "express";
import { runAgent } from "../services/orchestrator.js";

const router = express.Router();

router.post("/", async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const { message, sessionId, modelKey } = req.body ?? {};

    if (!message || !sessionId) {
      return res.status(400).json({ ok: false, error: "message and sessionId are required" });
    }

    const response = await runAgent({
      userId: sessionId,
      userMessage: message,
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