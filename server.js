import "dotenv/config";
import express from "express";
import chatRoute from "./routes/chat.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.use("/chat", chatRoute);

// Global error handler — ensures invalid JSON bodies / unexpected errors always return JSON
app.use((err, req, res, next) => {
  console.error("[Express error]", err.message);
  if (!res.headersSent) {
    res.status(err.status || 500).json({ ok: false, error: err.message || "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});