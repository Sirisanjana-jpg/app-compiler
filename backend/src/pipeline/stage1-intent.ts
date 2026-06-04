import { callLLM, safeParseJSON } from "../utils/llm.js";
import { IntentSchema, type Intent } from "../schemas/index.js";

const SYSTEM = `You are the Intent Extraction stage of an app compiler pipeline.
Your job is to parse a user's natural language app description into a strict structured JSON.
Rules:
- Extract ALL entities (nouns that need database tables)
- Extract ALL roles mentioned or implied
- Identify ALL features explicitly and implicitly mentioned
- If the user mentions "premium", assume payments=true
- If the user mentions "admin", assume RBAC=true
- If anything is ambiguous, document it in assumptions[] (make a reasonable choice) 
- Only add to clarificationsNeeded[] if the ambiguity would fundamentally change the schema
- Return ONLY valid JSON matching the schema. No prose.`;

const USER_TEMPLATE = (prompt: string) => `
Parse this app description into the intent schema:

"${prompt}"

Return JSON with this exact shape:
{
  "appName": string,
  "appType": string (e.g. "CRM", "E-commerce", "SaaS Dashboard"),
  "summary": string,
  "entities": [{ "name": string, "description": string, "fields": [{ "name": string, "type": "string"|"number"|"boolean"|"date"|"uuid"|"enum"|"text", "required": boolean, "enumValues"?: string[] }] }],
  "roles": [{ "name": string, "permissions": string[] }],
  "features": string[],
  "hasAuth": boolean,
  "hasPayments": boolean,
  "hasDashboard": boolean,
  "hasRBAC": boolean,
  "assumptions": string[],
  "clarificationsNeeded": string[]
}`;

export async function extractIntent(userPrompt: string): Promise<Intent> {
  const raw = await callLLM(SYSTEM, USER_TEMPLATE(userPrompt));
  const parsed = safeParseJSON(raw);
  return IntentSchema.parse(parsed);
}
