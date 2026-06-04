import { extractIntent } from "./stage1-intent.js";
import { designSystem } from "./stage2-design.js";
import { generateSchema } from "./stage3-schema.js";
import { validateAndRepair } from "./stage4-validator.js";
import { refineSchema } from "./stage5-refine.js";
import type { FullSchema, Intent, SystemDesign } from "../schemas/index.js";

export interface PipelineEvent {
  stage: number;
  name: string;
  status: "running" | "done" | "error";
  data?: unknown;
  error?: string;
  durationMs?: number;
}

export interface PipelineResult {
  success: boolean;
  schema?: FullSchema;
  intent?: Intent;
  design?: SystemDesign;
  events: PipelineEvent[];
  totalDurationMs: number;
  repairAttempts: number;
  validationIssues: unknown[];
  cost: {
    estimatedTokens: number;
    estimatedUSD: number;
  };
}

type ProgressCallback = (event: PipelineEvent) => void;

export async function runPipeline(
  userPrompt: string,
  onProgress?: ProgressCallback
): Promise<PipelineResult> {
  const events: PipelineEvent[] = [];
  const pipelineStart = Date.now();
  let repairAttempts = 0;
  let totalTokens = 0;

  const emit = (event: PipelineEvent) => {
    events.push(event);
    onProgress?.(event);
  };

  // Rough token estimate per stage
  const TOKEN_ESTIMATES = [0, 800, 2000, 4000, 3000, 2000];

  async function runStage<T>(
    stage: number,
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    emit({ stage, name, status: "running" });
    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      totalTokens += TOKEN_ESTIMATES[stage] || 1000;
      emit({ stage, name, status: "done", data: result, durationMs });
      return result;
    } catch (err: unknown) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      emit({ stage, name, status: "error", error, durationMs });
      throw err;
    }
  }

  try {
    // Stage 1
    const intent = await runStage(1, "Intent Extraction", () => extractIntent(userPrompt));

    // Stage 2
    const design = await runStage(2, "System Design", () => designSystem(intent));

    // Stage 3
    const rawSchema = await runStage(3, "Schema Generation", () => generateSchema(intent, design));

    // Stage 4
    const validationResult = await runStage(4, "Validation & Repair", () => validateAndRepair(rawSchema));
    repairAttempts = validationResult.repairAttempts;
    totalTokens += repairAttempts * 3000;

    const repairedSchema = validationResult.repairedSchema ?? rawSchema;
    const warnings = validationResult.issues.filter(i => i.severity === "warning");

    // Stage 5
    const finalSchema = await runStage(5, "Refinement", () => refineSchema(repairedSchema, warnings));

    const totalDurationMs = Date.now() - pipelineStart;

    // GPT-4o pricing: ~$5/1M input + $15/1M output tokens (rough blended)
    const estimatedUSD = (totalTokens / 1_000_000) * 10;

    return {
      success: true,
      schema: finalSchema,
      intent,
      design,
      events,
      totalDurationMs,
      repairAttempts,
      validationIssues: validationResult.issues,
      cost: {
        estimatedTokens: totalTokens,
        estimatedUSD: Math.round(estimatedUSD * 1000) / 1000
      }
    };
  } catch (err: unknown) {
    return {
      success: false,
      events,
      totalDurationMs: Date.now() - pipelineStart,
      repairAttempts,
      validationIssues: [],
      cost: { estimatedTokens: totalTokens, estimatedUSD: 0 }
    };
  }
}
