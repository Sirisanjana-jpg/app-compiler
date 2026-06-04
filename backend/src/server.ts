import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runPipeline, type PipelineEvent } from "./pipeline/index.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── Health check ─────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── SSE streaming pipeline endpoint ─────────────────────────
app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
    return res.status(400).json({ error: "Prompt must be at least 3 characters" });
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (type: string, data: unknown) => {
    res.write(`data: ${JSON.stringify({ type, ...data as object })}\n\n`);
  };

  try {
    const result = await runPipeline(prompt.trim(), (event: PipelineEvent) => {
      send("stage", {
        stage: event.stage,
        name: event.name,
        status: event.status,
        durationMs: event.durationMs,
        error: event.error
      });
    });

    send("complete", {
      success: result.success,
      schema: result.schema,
      intent: result.intent,
      totalDurationMs: result.totalDurationMs,
      repairAttempts: result.repairAttempts,
      validationIssues: result.validationIssues,
      cost: result.cost,
      events: result.events.map(e => ({
        stage: e.stage,
        name: e.name,
        status: e.status,
        durationMs: e.durationMs
      }))
    });
  } catch (err) {
    send("error", { message: String(err) });
  } finally {
    res.end();
  }
});

// ── Sync endpoint (for testing) ──────────────────────────────
app.post("/api/generate/sync", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const result = await runPipeline(prompt.trim());
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 App Compiler backend running on http://localhost:${PORT}`);
});
