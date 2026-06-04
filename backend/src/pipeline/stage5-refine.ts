import { callLLM, safeParseJSON } from "../utils/llm.js";
import { FullSchemaOutput, type FullSchema } from "../schemas/index.js";
import type { ValidationIssue } from "./stage4-validator.js";

const SYSTEM = `You are the Refinement stage of an app compiler pipeline.
You receive a validated schema and perform final consistency polish.
Tasks:
- Ensure all IDs are stable snake_case
- Add any missing navigation components for defined pages
- Ensure auth login/logout endpoints exist if hasAuth
- Verify all enum fields have enumValues in DB
- Fill any empty arrays that should have content
- Do NOT change correct existing values
- Return complete polished schema as valid JSON. No prose.`;

export async function refineSchema(
  schema: FullSchema,
  warnings: ValidationIssue[]
): Promise<FullSchema> {
  const warningContext = warnings.length > 0
    ? `\n\nWARNINGS TO ADDRESS:\n${warnings.map(w => `- [${w.code}] ${w.message}`).join("\n")}`
    : "";

  const USER = `Perform final refinement on this validated schema:${warningContext}

SCHEMA:
${JSON.stringify(schema, null, 2)}

Return the complete refined schema JSON.`;

  try {
    const raw = await callLLM(SYSTEM, USER, 0.1, 3000);
    const parsed = safeParseJSON(raw);
    return FullSchemaOutput.parse(parsed);
  } catch {
    // If refinement itself fails, return the validated schema as-is
    return schema;
  }
}
